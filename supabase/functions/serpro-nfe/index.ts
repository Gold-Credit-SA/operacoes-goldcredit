// Serpro NF-e proxy: token + consulta + push (cliente/solicitações).
// Endpoints (action no body):
//   consultar          { chave }
//   push_get_cliente   {}
//   push_set_cliente   { urlNotificacao }
//   push_solicitacoes  {}
//   push_criar         { chaves: string[] }
//   push_excluir       { solicitacaoId }
//   webhook            { chaveNFe, dataHoraEnvio }   (callback do Serpro)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SERPRO_BASE = "https://gateway.apiserpro.serpro.gov.br";
// Trial endpoint (sem custo) por padrão; troque para "/consulta-nfe-df/api/v1" em produção.
const NFE_BASE = `${SERPRO_BASE}/consulta-nfe-df-trial/api/v1`;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const key = Deno.env.get("SERPRO_CONSUMER_KEY");
  const secret = Deno.env.get("SERPRO_CONSUMER_SECRET");
  if (!key || !secret) throw new Error("Credenciais SERPRO ausentes");

  const basic = btoa(`${key}:${secret}`);
  const res = await fetch(`${SERPRO_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token SERPRO falhou [${res.status}]: ${text}`);
  const json = JSON.parse(text);
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3000) * 1000,
  };
  return cachedToken.value;
}

async function serproFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${NFE_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, ok: res.ok, json, text };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Webhook público (Serpro chama)
    if (action === "webhook") {
      const chave = body.chaveNFe;
      if (!chave) return jsonResponse({ error: "chaveNFe ausente" }, 400);

      // Persiste o evento
      const { data: eventoInsert } = await supabase
        .from("nfe_eventos")
        .insert({
          chave_acesso: chave,
          tipo_evento: body.tpEvento ?? null,
          descricao: body.descEvento ?? "Notificação Serpro",
          data_evento: body.dataHoraEnvio ?? new Date().toISOString(),
          payload: body,
        })
        .select()
        .single();

      // Busca descrição cadastrada para a chave (se houver)
      const { data: monit } = await supabase
        .from("nfe_monitoramento")
        .select("descricao")
        .eq("chave_acesso", chave)
        .limit(1)
        .maybeSingle();

      // Notifica todos os usuários cadastrados (profiles)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email");

      const emails = (profiles ?? [])
        .map((p: { email: string }) => p.email)
        .filter((e: string) => !!e);

      const eventoId = eventoInsert?.id ?? crypto.randomUUID();
      const templateData = {
        chave,
        tipoEvento: body.tpEvento ?? null,
        descricao: body.descEvento ?? "Notificação Serpro",
        dataEvento: body.dataHoraEnvio ?? new Date().toISOString(),
        descricaoChave: monit?.descricao ?? null,
      };

      // Dispara um e-mail por destinatário via fetch direto (service role)
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      await Promise.all(
        emails.map((email: string) =>
          fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({
              templateName: "nfe-evento",
              recipientEmail: email,
              idempotencyKey: `nfe-evento-${eventoId}-${email}`,
              templateData,
            }),
          })
            .then(async (r) => {
              if (!r.ok) console.error("send-email failed", email, r.status, await r.text());
            })
            .catch((e) => console.error("Falha ao enfileirar e-mail:", email, e)),
        ),
      );

      return jsonResponse({ ok: true, notificados: emails.length });
    }

    // Demais ações exigem usuário autenticado
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    switch (action) {
      case "consultar": {
        const chave = String(body.chave ?? "").replace(/\D/g, "");
        if (chave.length !== 44) return jsonResponse({ error: "Chave deve ter 44 dígitos" }, 400);
        const r = await serproFetch(`/nfe/${chave}`, { method: "GET" });
        // Persiste último resultado se a chave estiver monitorada por este usuário
        if (r.ok) {
          await supabase
            .from("nfe_monitoramento")
            .update({
              ultima_consulta_em: new Date().toISOString(),
              ultimo_resultado: r.json,
            })
            .eq("user_id", user.id)
            .eq("chave_acesso", chave);
        }
        return jsonResponse({ status: r.status, ok: r.ok, data: r.json ?? r.text });
      }

      case "push_get_cliente": {
        const r = await serproFetch(`/nfe/push/clientes`, { method: "GET" });
        return jsonResponse({ status: r.status, ok: r.ok, data: r.json ?? r.text });
      }

      case "push_set_cliente": {
        const urlNotificacao = body.urlNotificacao;
        if (!urlNotificacao) return jsonResponse({ error: "urlNotificacao obrigatória" }, 400);
        // Tenta POST; se já existe, faz PUT
        let r = await serproFetch(`/nfe/push/clientes`, {
          method: "POST",
          body: JSON.stringify({ urlNotificacao }),
        });
        if (!r.ok && (r.status === 409 || r.status === 400)) {
          r = await serproFetch(`/nfe/push/clientes`, {
            method: "PUT",
            body: JSON.stringify({ urlNotificacao }),
          });
        }
        return jsonResponse({ status: r.status, ok: r.ok, data: r.json ?? r.text });
      }

      case "push_solicitacoes": {
        const r = await serproFetch(`/nfe/push/solicitacoes`, { method: "GET" });
        return jsonResponse({ status: r.status, ok: r.ok, data: r.json ?? r.text });
      }

      case "push_criar": {
        const chaves = (body.chaves ?? []).map((c: string) => String(c).replace(/\D/g, ""));
        if (!chaves.length) return jsonResponse({ error: "chaves vazias" }, 400);
        const r = await serproFetch(`/nfe/push/solicitacoes`, {
          method: "POST",
          body: JSON.stringify({ chavesMonitoracao: chaves }),
        });
        if (r.ok && r.json && typeof r.json === "object") {
          const sid = (r.json as { solicitacaoId?: string }).solicitacaoId;
          if (sid) {
            await supabase
              .from("nfe_monitoramento")
              .update({ solicitacao_id: sid })
              .eq("user_id", user.id)
              .in("chave_acesso", chaves);
          }
        }
        return jsonResponse({ status: r.status, ok: r.ok, data: r.json ?? r.text });
      }

      case "push_excluir": {
        const sid = body.solicitacaoId;
        if (!sid) return jsonResponse({ error: "solicitacaoId obrigatório" }, 400);
        const r = await serproFetch(`/nfe/push/solicitacoes/${sid}`, { method: "DELETE" });
        return jsonResponse({ status: r.status, ok: r.ok, data: r.json ?? r.text });
      }

      default:
        return jsonResponse({ error: "Ação inválida" }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("serpro-nfe error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
