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

function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D+/g, "");
}

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
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return String(d); }
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

function getExternalSql() {
  const host = Deno.env.get("EXTERNAL_DB_HOST")!;
  const port = Number(Deno.env.get("EXTERNAL_DB_PORT") ?? "5432");
  const user = Deno.env.get("EXTERNAL_DB_USER")!;
  const pass = Deno.env.get("EXTERNAL_DB_PASS")!;
  const db = Deno.env.get("EXTERNAL_DB_NAME")!;
  return postgres({ host, port, user, password: pass, database: db, ssl: "prefer", max: 3 });
}

async function listOverdue(cedenteCpfCnpj?: string, minDays = 1) {
  const sql = getExternalSql();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = cedenteCpfCnpj
      ? await sql`
          SELECT numero_titulo, cpf_cnpj_sacado, sacado, cpf_cnpj_cedente, cedente,
                 valor, vencimento
          FROM smartsecurities_titulos_em_aberto
          WHERE vencimento < ${today}
            AND REPLACE(REPLACE(REPLACE(cpf_cnpj_cedente,'.',''),'-',''),'/','') = ${onlyDigits(cedenteCpfCnpj)}
          ORDER BY vencimento ASC
          LIMIT 500
        `
      : await sql`
          SELECT numero_titulo, cpf_cnpj_sacado, sacado, cpf_cnpj_cedente, cedente,
                 valor, vencimento
          FROM smartsecurities_titulos_em_aberto
          WHERE vencimento < ${today}
          ORDER BY vencimento ASC
          LIMIT 1000
        `;

    const now = new Date();
    const result = rows.map((r: any) => {
      const venc = r.vencimento ? new Date(r.vencimento) : null;
      const dias = venc ? Math.floor((now.getTime() - venc.getTime()) / 86400000) : 0;
      return {
        numero_titulo: r.numero_titulo,
        sacado_cpf_cnpj: onlyDigits(r.cpf_cnpj_sacado ?? ""),
        sacado_nome: r.sacado,
        cedente_cpf_cnpj: onlyDigits(r.cpf_cnpj_cedente ?? ""),
        cedente_nome: r.cedente,
        valor: Number(r.valor ?? 0),
        vencimento: r.vencimento,
        dias_atraso: dias,
      };
    }).filter((t: any) => t.dias_atraso >= minDays);

    return result;
  } finally {
    try { await sql.end({ timeout: 1 }); } catch { /* noop */ }
  }
}

async function sendEvolution(numero: string, mensagem: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) {
    throw new Error("Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE)");
  }
  const url = `${EVO_URL}/message/sendText/${EVO_INSTANCE}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVO_KEY,
    },
    body: JSON.stringify({
      number: numero,
      text: mensagem,
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user
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

    if (action === "list-overdue") {
      const data = await listOverdue(body.cedenteCpfCnpj, Number(body.minDays ?? 1));
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send-batch") {
      const { template, items } = body as {
        template: string;
        items: Array<{
          telefone: string;
          sacado_cpf_cnpj: string;
          sacado_nome?: string;
          cedente_cpf_cnpj?: string;
          cedente_nome?: string;
          numero_titulo?: string;
          valor?: number;
          vencimento?: string;
          dias_atraso?: number;
        }>;
      };

      if (!template?.trim()) {
        return new Response(JSON.stringify({ error: "Template vazio" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum item para enviar" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user name
      const { data: profile } = await supabase
        .from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      const userName = profile?.name ?? user.email ?? "";

      const results: Array<{ index: number; status: string; error?: string }> = [];

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const tel = formatPhoneBR(it.telefone);
        const msg = renderTemplate(template, {
          sacado_nome: it.sacado_nome ?? "",
          sacado_cpf_cnpj: it.sacado_cpf_cnpj ?? "",
          cedente_nome: it.cedente_nome ?? "",
          numero_titulo: it.numero_titulo ?? "",
          valor: formatBRL(it.valor),
          vencimento: formatDate(it.vencimento),
          dias_atraso: String(it.dias_atraso ?? ""),
        });

        if (!tel) {
          await supabase.from("cobranca_envios").insert({
            user_id: user.id, user_name: userName,
            sacado_cpf_cnpj: it.sacado_cpf_cnpj, sacado_nome: it.sacado_nome,
            cedente_cpf_cnpj: it.cedente_cpf_cnpj, cedente_nome: it.cedente_nome,
            telefone: it.telefone ?? "", numero_titulo: it.numero_titulo,
            valor: it.valor, vencimento: it.vencimento, dias_atraso: it.dias_atraso,
            mensagem: msg, status: "erro", error_message: "Telefone inválido",
          });
          results.push({ index: i, status: "erro", error: "Telefone inválido" });
          continue;
        }

        try {
          const r = await sendEvolution(tel, msg);
          const ok = r.ok && r.status >= 200 && r.status < 300;
          await supabase.from("cobranca_envios").insert({
            user_id: user.id, user_name: userName,
            sacado_cpf_cnpj: it.sacado_cpf_cnpj, sacado_nome: it.sacado_nome,
            cedente_cpf_cnpj: it.cedente_cpf_cnpj, cedente_nome: it.cedente_nome,
            telefone: tel, numero_titulo: it.numero_titulo,
            valor: it.valor, vencimento: it.vencimento, dias_atraso: it.dias_atraso,
            mensagem: msg,
            status: ok ? "enviado" : "erro",
            evolution_response: r.body,
            error_message: ok ? null : `HTTP ${r.status}`,
          });
          results.push({ index: i, status: ok ? "enviado" : "erro", error: ok ? undefined : `HTTP ${r.status}` });
        } catch (e) {
          const msgErr = e instanceof Error ? e.message : String(e);
          await supabase.from("cobranca_envios").insert({
            user_id: user.id, user_name: userName,
            sacado_cpf_cnpj: it.sacado_cpf_cnpj, sacado_nome: it.sacado_nome,
            cedente_cpf_cnpj: it.cedente_cpf_cnpj, cedente_nome: it.cedente_nome,
            telefone: tel, numero_titulo: it.numero_titulo,
            valor: it.valor, vencimento: it.vencimento, dias_atraso: it.dias_atraso,
            mensagem: msg, status: "erro", error_message: msgErr,
          });
          results.push({ index: i, status: "erro", error: msgErr });
        }

        // Pequena pausa entre envios para não saturar a instância
        await new Promise((r) => setTimeout(r, 400));
      }

      const enviados = results.filter((r) => r.status === "enviado").length;
      const erros = results.length - enviados;
      return new Response(JSON.stringify({ success: true, enviados, erros, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cobranca-whatsapp error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
