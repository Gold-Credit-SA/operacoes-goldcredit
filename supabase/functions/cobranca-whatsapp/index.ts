// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EVO_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/+$/, "");
const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVO_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function onlyDigits(s: string): string { return (s ?? "").replace(/\D+/g, ""); }

function formatPhoneBR(raw: string): string {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

function formatBRL(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace("R$", "").trim();
}

function formatDate(d: any): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return String(d); }
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return (tpl ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

function getExternalSql() {
  const host = Deno.env.get("EXTERNAL_DB_HOST")!;
  const port = Number(Deno.env.get("EXTERNAL_DB_PORT") ?? "5432");
  const user = Deno.env.get("EXTERNAL_DB_USER")!;
  const pass = Deno.env.get("EXTERNAL_DB_PASS")!;
  const db = Deno.env.get("EXTERNAL_DB_NAME")!;
  return postgres({ host, port, user, password: pass, database: db, ssl: "prefer", max: 3 });
}

type Titulo = {
  numero_titulo: string;
  id_titulo?: string | null;
  nosso_numero?: string | null;
  sacado_cpf_cnpj: string;
  sacado_nome: string;
  cedente_cpf_cnpj: string;
  cedente_nome: string;
  valor: number;
  vencimento: string | null;
  dias_atraso: number;
  telefone?: string;
  email?: string;
};

function buildSmartUrl(tpl: string | null | undefined, t: { id_titulo?: string | null; nosso_numero?: string | null; numero_titulo?: string; cedente_cpf_cnpj?: string; sacado_cpf_cnpj?: string }): string {
  if (!tpl?.trim()) return "";
  return tpl
    .replace(/\{id_titulo\}/g, encodeURIComponent(t.id_titulo ?? ""))
    .replace(/\{nosso_numero\}/g, encodeURIComponent(t.nosso_numero ?? ""))
    .replace(/\{documento\}/g, encodeURIComponent(t.numero_titulo ?? ""))
    .replace(/\{numero_titulo\}/g, encodeURIComponent(t.numero_titulo ?? ""))
    .replace(/\{cedente_cpf_cnpj\}/g, encodeURIComponent(t.cedente_cpf_cnpj ?? ""))
    .replace(/\{sacado_cpf_cnpj\}/g, encodeURIComponent(t.sacado_cpf_cnpj ?? ""));
}

async function listOpenTitles(opts: {
  cedenteCpfCnpj?: string;
  sacadoCpfCnpj?: string;
  minDays?: number;
  onlyOverdue?: boolean;
  limit?: number;
} = {}): Promise<Titulo[]> {
  const { cedenteCpfCnpj, sacadoCpfCnpj, minDays = 0, onlyOverdue = false, limit = 3000 } = opts;
  const sql = getExternalSql();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await sql`
      SELECT documento, cpf_cnpj_sacado, sacado, cpf_cnpj_cedente, cedente,
             valor, vencimento
      FROM smartsecurities_titulos_em_aberto
      WHERE 1=1
        ${cedenteCpfCnpj ? sql`AND REPLACE(REPLACE(REPLACE(cpf_cnpj_cedente,'.',''),'-',''),'/','') = ${onlyDigits(cedenteCpfCnpj)}` : sql``}
        ${sacadoCpfCnpj ? sql`AND REPLACE(REPLACE(REPLACE(cpf_cnpj_sacado,'.',''),'-',''),'/','') = ${onlyDigits(sacadoCpfCnpj)}` : sql``}
        ${onlyOverdue ? sql`AND vencimento < ${today}` : sql``}
      ORDER BY vencimento DESC NULLS LAST
      LIMIT ${limit}
    `;
    const now = new Date();
    return rows.map((r: any) => {
      const venc = r.vencimento ? new Date(r.vencimento) : null;
      const dias = venc ? Math.floor((now.getTime() - venc.getTime()) / 86400000) : 0;
      return {
        numero_titulo: r.documento,
        sacado_cpf_cnpj: onlyDigits(r.cpf_cnpj_sacado ?? ""),
        sacado_nome: r.sacado,
        cedente_cpf_cnpj: onlyDigits(r.cpf_cnpj_cedente ?? ""),
        cedente_nome: r.cedente,
        valor: Number(r.valor ?? 0),
        vencimento: r.vencimento,
        dias_atraso: dias,
      };
    }).filter((t: Titulo) => (minDays > 0 ? t.dias_atraso >= minDays : true));
  } finally {
    try { await sql.end({ timeout: 1 }); } catch { /* noop */ }
  }
}

async function enrichContacts(titulos: Titulo[]): Promise<Titulo[]> {
  if (titulos.length === 0) return titulos;
  const sacadoDocs = Array.from(new Set(titulos.map(t => t.sacado_cpf_cnpj).filter(Boolean)));
  if (sacadoDocs.length === 0) return titulos;
  const sql = getExternalSql();
  try {
    const rows = await sql`
      SELECT cpf_cnpj_sacado, telefone, email
      FROM smartsecurities_sacados
      WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj_sacado,'.',''),'-',''),'/','') IN ${sql(sacadoDocs)}
    `;
    const map = new Map<string, { telefone: string; email: string }>();
    for (const r of rows as any[]) {
      const k = onlyDigits(r.cpf_cnpj_sacado);
      if (!map.has(k)) map.set(k, { telefone: r.telefone ?? "", email: r.email ?? "" });
    }
    return titulos.map(t => ({ ...t, telefone: map.get(t.sacado_cpf_cnpj)?.telefone, email: map.get(t.sacado_cpf_cnpj)?.email }));
  } catch (e) {
    console.warn("enrichContacts failed:", e);
    return titulos;
  } finally {
    try { await sql.end({ timeout: 1 }); } catch { /* noop */ }
  }
}

async function sendEvolution(numero: string, mensagem: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) {
    throw new Error("Evolution API não configurada");
  }
  const url = `${EVO_URL}/message/sendText/${EVO_INSTANCE}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVO_KEY },
    body: JSON.stringify({ number: numero, text: mensagem }),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, body: json };
}

async function sendEmail(authHeader: string, to: string, assunto: string, corpo: string, vars: Record<string, string>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": authHeader },
    body: JSON.stringify({
      templateName: "cobranca-aviso",
      recipientEmail: to,
      templateData: { assunto, corpo, ...vars },
    }),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, body: json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as string;

    const ok = (data: any) => new Response(JSON.stringify({ success: true, ...data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const fail = (msg: string, status = 200) => new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // ---------- LIST ----------
    if (action === "list-overdue" || action === "list-open") {
      const data = await listOpenTitles({
        cedenteCpfCnpj: body.cedenteCpfCnpj,
        sacadoCpfCnpj: body.sacadoCpfCnpj,
        minDays: Number(body.minDays ?? 0),
        onlyOverdue: action === "list-overdue" ? (body.onlyOverdue ?? true) : !!body.onlyOverdue,
      });
      const enriched = body.enrich ? await enrichContacts(data) : data;
      return ok({ data: enriched });
    }

    // ---------- DASHBOARD ----------
    if (action === "dashboard") {
      const todos = await listOpenTitles({ onlyOverdue: false, limit: 5000 });
      const overdue = todos.filter(t => t.dias_atraso > 0);
      const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      const bucketsValor = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      for (const t of overdue) {
        const k = t.dias_atraso <= 30 ? '0-30' : t.dias_atraso <= 60 ? '31-60' : t.dias_atraso <= 90 ? '61-90' : '90+';
        buckets[k]++; bucketsValor[k] += t.valor;
      }
      // Top devedores agrupados por sacado
      const bySacado = new Map<string, { sacado_nome: string; sacado_cpf_cnpj: string; total: number; qtd: number; max_atraso: number }>();
      for (const t of overdue) {
        const k = t.sacado_cpf_cnpj || t.sacado_nome;
        const cur = bySacado.get(k) ?? { sacado_nome: t.sacado_nome, sacado_cpf_cnpj: t.sacado_cpf_cnpj, total: 0, qtd: 0, max_atraso: 0 };
        cur.total += t.valor; cur.qtd++; cur.max_atraso = Math.max(cur.max_atraso, t.dias_atraso);
        bySacado.set(k, cur);
      }
      const topDevedores = Array.from(bySacado.values()).sort((a, b) => b.total - a.total).slice(0, 10);

      const totalAberto = todos.reduce((s, t) => s + t.valor, 0);
      const totalAtraso = overdue.reduce((s, t) => s + t.valor, 0);

      // Envios últimos 7 dias
      const since = new Date(); since.setDate(since.getDate() - 7);
      const { data: envios } = await supabase
        .from("cobranca_envios")
        .select("created_at,status,canal")
        .gte("created_at", since.toISOString());
      const enviosUlt7 = envios?.length ?? 0;

      // Promessas vencendo nos próximos 7 dias
      const in7 = new Date(); in7.setDate(in7.getDate() + 7);
      const { data: promessas } = await supabase
        .from("cobranca_promessas")
        .select("id,data_prometida,valor_prometido,sacado_cpf_cnpj")
        .eq("cumprida", false)
        .lte("data_prometida", in7.toISOString().slice(0, 10));

      return ok({
        data: {
          totalAberto, totalAtraso,
          qtdAberto: todos.length, qtdAtraso: overdue.length,
          aging: Object.entries(buckets).map(([faixa, qtd]) => ({ faixa, qtd, valor: bucketsValor[faixa as keyof typeof bucketsValor] })),
          topDevedores,
          enviosUlt7,
          promessasProximas: promessas ?? [],
        },
      });
    }

    // ---------- SUGGESTIONS ----------
    if (action === "suggestions") {
      const titulos = await enrichContacts(await listOpenTitles({ onlyOverdue: true, limit: 5000 }));
      const { data: regua } = await supabase.from("cobranca_regua").select("*").eq("ativo", true).order("ordem");
      const { data: status } = await supabase.from("cobranca_titulo_status").select("*");
      const { data: promessas } = await supabase.from("cobranca_promessas").select("*").eq("cumprida", false);

      const statusMap = new Map(status?.map((s: any) => [`${s.cedente_cpf_cnpj}|${s.numero_titulo}`, s]) ?? []);
      const promessaMap = new Map<string, any>();
      for (const p of promessas ?? []) {
        const k = p.sacado_cpf_cnpj;
        const cur = promessaMap.get(k);
        if (!cur || new Date(p.data_prometida) > new Date(cur.data_prometida)) promessaMap.set(k, p);
      }

      const hoje = new Date();
      const sugestoes = titulos.map(t => {
        const key = `${t.cedente_cpf_cnpj}|${t.numero_titulo}`;
        const st = statusMap.get(key) as any;
        const promessa = promessaMap.get(t.sacado_cpf_cnpj);
        const promessaVigente = promessa && new Date(promessa.data_prometida) >= hoje;

        // Faixa
        const faixa = (regua ?? []).find((r: any) =>
          t.dias_atraso >= r.dias_min && (r.dias_max == null || t.dias_atraso <= r.dias_max)
        );

        const score = (t.dias_atraso * 0.4) + (Math.log10(Math.max(t.valor, 1)) * 60);
        return {
          ...t,
          status: st?.status ?? 'em_dia',
          ultimo_contato_at: st?.ultimo_contato_at,
          tem_promessa: !!promessaVigente,
          promessa_data: promessa?.data_prometida,
          faixa_id: faixa?.id, faixa_nome: faixa?.nome,
          faixa_canal: faixa?.canal, faixa_template_id: faixa?.template_id,
          score,
        };
      })
      .filter(t => !t.tem_promessa && t.status !== 'acordo' && t.status !== 'quitado')
      .sort((a, b) => b.score - a.score);

      return ok({ data: sugestoes });
    }

    // ---------- SEND BATCH (WhatsApp + Email) ----------
    if (action === "send-batch") {
      const { template, assunto, canal = 'whatsapp', items } = body as any;
      if (!template?.trim()) return fail("Template vazio");
      if (!Array.isArray(items) || items.length === 0) return fail("Nenhum item para enviar");

      const { data: profile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      const userName = profile?.name ?? user.email ?? "";

      const results: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const vars = {
          sacado_nome: it.sacado_nome ?? "",
          sacado_cpf_cnpj: it.sacado_cpf_cnpj ?? "",
          cedente_nome: it.cedente_nome ?? "",
          numero_titulo: it.numero_titulo ?? "",
          valor: formatBRL(it.valor),
          vencimento: formatDate(it.vencimento),
          dias_atraso: String(it.dias_atraso ?? ""),
        };
        const msg = renderTemplate(template, vars);
        const assuntoR = renderTemplate(assunto ?? "Aviso de cobrança", vars);

        let status = "erro", errMsg: string | null = null, response: any = null;
        let dest = "";

        try {
          if (canal === 'email') {
            dest = (it.email ?? "").trim();
            if (!dest || !dest.includes("@")) throw new Error("E-mail inválido");
            const r = await sendEmail(authHeader, dest, assuntoR, msg, vars);
            response = r.body;
            if (r.ok) status = "enviado"; else errMsg = `HTTP ${r.status}`;
          } else {
            const tel = formatPhoneBR(it.telefone ?? "");
            dest = tel;
            if (!tel) throw new Error("Telefone inválido");
            const r = await sendEvolution(tel, msg);
            response = r.body;
            if (r.ok) status = "enviado"; else errMsg = `HTTP ${r.status}`;
          }
        } catch (e) {
          errMsg = e instanceof Error ? e.message : String(e);
        }

        await supabase.from("cobranca_envios").insert({
          user_id: user.id, user_name: userName, canal,
          sacado_cpf_cnpj: it.sacado_cpf_cnpj, sacado_nome: it.sacado_nome,
          cedente_cpf_cnpj: it.cedente_cpf_cnpj, cedente_nome: it.cedente_nome,
          telefone: canal === 'whatsapp' ? dest : (it.telefone ?? ""),
          email_destinatario: canal === 'email' ? dest : null,
          assunto: canal === 'email' ? assuntoR : null,
          numero_titulo: it.numero_titulo, valor: it.valor,
          vencimento: it.vencimento, dias_atraso: it.dias_atraso,
          mensagem: msg, status, evolution_response: response, error_message: errMsg,
        });

        // Atualiza status do título para "notificado"
        if (status === "enviado" && it.numero_titulo && it.cedente_cpf_cnpj) {
          await supabase.from("cobranca_titulo_status").upsert({
            cedente_cpf_cnpj: it.cedente_cpf_cnpj,
            numero_titulo: it.numero_titulo,
            sacado_cpf_cnpj: it.sacado_cpf_cnpj,
            sacado_nome: it.sacado_nome,
            status: 'notificado',
            ultimo_contato_at: new Date().toISOString(),
            updated_by: user.id,
          }, { onConflict: 'cedente_cpf_cnpj,numero_titulo' });
        }

        results.push({ index: i, status, error: errMsg ?? undefined });
        await new Promise(r => setTimeout(r, canal === 'email' ? 200 : 400));
      }

      const enviados = results.filter(r => r.status === "enviado").length;
      return ok({ enviados, erros: results.length - enviados, results });
    }

    // ---------- TIMELINE (visão 360 do sacado) ----------
    if (action === "timeline") {
      const sacadoCpfCnpj = onlyDigits(body.sacadoCpfCnpj ?? "");
      if (!sacadoCpfCnpj) return fail("sacadoCpfCnpj obrigatório");

      const [envios, notas, promessas, acordos, titulosAbertos] = await Promise.all([
        supabase.from("cobranca_envios").select("*").eq("sacado_cpf_cnpj", sacadoCpfCnpj).order("created_at", { ascending: false }).limit(200),
        supabase.from("cobranca_notas").select("*").eq("sacado_cpf_cnpj", sacadoCpfCnpj).order("created_at", { ascending: false }),
        supabase.from("cobranca_promessas").select("*").eq("sacado_cpf_cnpj", sacadoCpfCnpj).order("data_prometida", { ascending: false }),
        supabase.from("cobranca_acordos").select("*").eq("sacado_cpf_cnpj", sacadoCpfCnpj).order("created_at", { ascending: false }),
        enrichContacts(await listOpenTitles({ sacadoCpfCnpj, onlyOverdue: false, limit: 200 })),
      ]);

      return ok({
        data: {
          envios: envios.data ?? [],
          notas: notas.data ?? [],
          promessas: promessas.data ?? [],
          acordos: acordos.data ?? [],
          titulosAbertos,
        },
      });
    }

    return fail("Ação inválida");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cobranca-whatsapp error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
