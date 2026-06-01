// deno-lint-ignore-file no-explicit-any
// Smart Securities API v2 client.
// Doc base: https://api.smartsecurities.com.br
// OAuth2 client_credentials, token TTL = 1h, rate limit 20 req/min.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SMART_BASE = "https://api.smartsecurities.com.br";

// Token cache em memória (a edge function pode ser reaproveitada por várias requests)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const id = Deno.env.get("SMART_CLIENT_ID");
  const secret = Deno.env.get("SMART_CLIENT_SECRET");
  if (!id || !secret) throw new Error("SMART_CLIENT_ID/SECRET não configurados");

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const res = await fetch(`${SMART_BASE}/oauth`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth Smart falhou (${res.status}): ${text.slice(0, 300)}`);
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`OAuth Smart retorno inválido: ${text.slice(0, 200)}`); }
  if (!json.access_token) throw new Error("OAuth Smart sem access_token");
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + Math.max(60, Number(json.expires_in ?? 3600)) * 1000,
  };
  return cachedToken.value;
}

async function smartGet(path: string, query: Record<string, string | number | undefined> = {}): Promise<any> {
  const token = await getToken();
  const url = new URL(`${SMART_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* mantém null */ }
  if (!res.ok) {
    const msg = json?.message || text.slice(0, 300);
    throw new Error(`Smart API ${res.status} ${path}: ${msg}`);
  }
  return json;
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function dateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, params } = await req.json().catch(() => ({ action: "test", params: {} }));

    switch (action) {
      case "test": {
        // Apenas valida OAuth
        const token = await getToken();
        return ok({ connected: true, token_preview: `${token.slice(0, 6)}…${token.slice(-4)}`, expires_at: cachedToken?.expiresAt });
      }

      case "titulos-aberto": {
        // GET /smartsecurities/titulo?tipo=emaberto&tipoSaida=json[&page=N]
        // Filtros opcionais: docSacado, docCedente, vencimentoIni, vencimentoFim, page
        const q: Record<string, string | number> = {
          tipo: "emaberto",
          tipoSaida: "json",
          page: Number(params?.page ?? 1),
        };
        if (params?.docSacado) q.docSacado = String(params.docSacado);
        if (params?.docCedente) q.docCedente = String(params.docCedente);
        if (params?.vencimentoIni) q.vencimentoIni = String(params.vencimentoIni);
        if (params?.vencimentoFim) q.vencimentoFim = String(params.vencimentoFim);
        // Default: títulos vencidos (vencimento até hoje)
        if (!q.vencimentoFim && !params?.skipDefaultRange) {
          q.vencimentoFim = todayBR();
          const start = new Date();
          start.setFullYear(start.getFullYear() - 2);
          q.vencimentoIni = dateBR(start);
        }
        const data = await smartGet("/smartsecurities/titulo", q);
        const items = data?._embedded?.titulo ?? [];
        return ok({
          page: data?.page ?? 1,
          page_count: data?.page_count ?? 1,
          total_items: data?.total_items ?? items.length,
          items,
        });
      }

      case "titulos-quitados": {
        const q: Record<string, string | number> = {
          tipo: "quitados",
          tipoSaida: "json",
          page: Number(params?.page ?? 1),
        };
        if (params?.docSacado) q.docSacado = String(params.docSacado);
        if (params?.quitacaoIni) q.quitacaoIni = String(params.quitacaoIni);
        if (params?.quitacaoFim) q.quitacaoFim = String(params.quitacaoFim);
        const data = await smartGet("/smartsecurities/titulo", q);
        const items = data?._embedded?.titulo ?? [];
        return ok({
          page: data?.page ?? 1,
          page_count: data?.page_count ?? 1,
          total_items: data?.total_items ?? items.length,
          items,
        });
      }

      case "boleto-pdf":
      case "nf-pdf": {
        // A API v2 publicada NÃO expõe download direto de boleto/NF por título.
        // Mantemos o stub aqui pronto pra ativar assim que a Smart liberar o endpoint.
        // Quando liberarem, substituir este bloco por:
        //   const pdf = await smartGet(`/smartsecurities/titulo/${id_titulo}/boleto`)
        //   return new Response(base64ToBytes(pdf.conteudoArquivo), { headers: {...corsHeaders, "Content-Type": "application/pdf"} })
        return new Response(
          JSON.stringify({
            success: false,
            unsupported: true,
            message:
              action === "boleto-pdf"
                ? "A API v2 do Smart ainda não expõe download de boleto por título. Use a URL configurada na aba Régua como fallback."
                : "A API v2 do Smart ainda não expõe download de NF por título. Use a URL configurada na aba Régua como fallback.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return bad(`Ação desconhecida: ${action}`);
    }
  } catch (e: any) {
    console.error("[smart-api] error:", e?.message ?? e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function bad(error: string) {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
