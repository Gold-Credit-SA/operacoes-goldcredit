import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGRISK_BASE = "https://api.agrisk.digital";

const PRODUCT_MAP: Record<string, { code: string; _id: string }> = {
  consulta_cliente: { code: "consulta-cliente", _id: "Y9kboNavmB0DjJGxAVWn" },
  imoveis_simples: { code: "pesquisa-imoveis", _id: "9Z6kr6GlVG6n6fM7k7Yb" },
  imoveis_car: { code: "car", _id: "d9e66bd5-300a-49dd-ab49-9133dcccab96" },
  patrimonio_veicular: { code: "vehicle-assets", _id: "8a6dd886-902c-4745-a8e0-e81db1e10e93" },
};

// ── Utility ──

async function fetchJson(url: string, token: string, timeoutMs = 5000): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.log(`GET ${url} → ${res.status}`);
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Auth ──

async function agriskLogin(): Promise<string> {
  const credential = Deno.env.get("AGRISK_CREDENTIAL");
  const password = Deno.env.get("AGRISK_PASSWORD");
  if (!credential || !password) throw new Error("Credenciais AgRisk não configuradas.");

  const res = await fetch(`${AGRISK_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, password }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha no login AgRisk (${res.status}): ${txt}`);
  }

  const data = await res.json();
  return data.token;
}

// ── Products ──

async function listProducts(token: string): Promise<any[]> {
  const res = await fetch(`${AGRISK_BASE}/v2/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ao listar produtos (${res.status}): ${txt}`);
  }
  const data = await res.json();
  return data.items || data || [];
}

// ── Client ──

async function findClientByTaxId(token: string, taxId: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${AGRISK_BASE}/v2/clients?filter=all&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    const items = data.items || data;
    if (!Array.isArray(items) || items.length === 0) break;
    const found = items.find((c: any) => c.taxId?.replace(/\D/g, "") === taxId.replace(/\D/g, ""));
    if (found) return found.id || found._id;
  }
  return null;
}

async function getOrCreateClient(token: string, taxId: string): Promise<string> {
  const existingId = await findClientByTaxId(token, taxId);
  if (existingId) return existingId;

  const createRes = await fetch(`${AGRISK_BASE}/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taxId }),
  });

  if (createRes.ok) {
    const data = await createRes.json();
    return data.id || data._id || data.clientId;
  }

  const errText = await createRes.text();
  try {
    const errData = JSON.parse(errText);
    if (errData.id || errData.clientId || errData._id) {
      return errData.id || errData.clientId || errData._id;
    }
  } catch {}

  throw new Error("Não foi possível cadastrar ou encontrar o cliente com o documento informado.");
}

// ── Query Request ──

async function requestQuery(token: string, clientId: string, productIds: string[]): Promise<any> {
  const res = await fetch(`${AGRISK_BASE}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clients: [clientId], products: productIds }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ao solicitar consulta (${res.status}): ${txt}`);
  }

  return await res.json();
}

// ── Extract queryId from POST /queries response ──

function extractQueryId(queryResult: any): string | null {
  if (queryResult?.queryId) return queryResult.queryId;
  if (queryResult?.id) return queryResult.id;
  if (queryResult?._id) return queryResult._id;
  if (queryResult?.items?.[0]?.queryId) return queryResult.items[0].queryId;
  if (queryResult?.items?.[0]?.id) return queryResult.items[0].id;

  // Check if response has a queries object with sub-query arrays
  const queries = queryResult?.items?.[0]?.queries || queryResult?.queries;
  if (queries && typeof queries === "object") {
    const firstKey = Object.keys(queries)[0];
    if (firstKey && Array.isArray(queries[firstKey]) && queries[firstKey][0]?.queryId) {
      return queries[firstKey][0].queryId;
    }
  }

  // Check nested arrays
  for (const key of Object.keys(queryResult || {})) {
    if (Array.isArray(queryResult[key]) && queryResult[key][0]?.queryId) {
      return queryResult[key][0].queryId;
    }
  }

  return null;
}

// ── Poll sub-query statuses ──

async function waitForSubQueries(token: string, clientId: string, maxWaitMs = 20000): Promise<Record<string, any> | null> {
  const start = Date.now();
  const interval = 2500;

  // Initial wait for processing to start
  await new Promise((r) => setTimeout(r, 2000));

  while (Date.now() - start < maxWaitMs) {
    const data = await fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}`, token, 4000);
    if (!data) {
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }

    // The response is a flat object: { "kyc": [...], "tst": [...], "cnd-ba": [...], ... }
    const metaKeys = new Set(["queryId", "status", "id", "_id", "message", "items", "statusCode"]);
    const subQueryKeys = Object.keys(data).filter((k) => !metaKeys.has(k) && Array.isArray(data[k]));

    if (subQueryKeys.length === 0) {
      await new Promise((r) => setTimeout(r, interval));
      continue;
    }

    // Check how many are done
    let doneCount = 0;
    let totalCount = subQueryKeys.length;
    for (const key of subQueryKeys) {
      const entries = data[key];
      const latest = entries[0]; // Most recent entry
      const status = (latest?.status || "").toUpperCase();
      if (["FINALIZADO", "DONE", "SUCCESS", "COMPLETED"].includes(status)) doneCount++;
    }

    console.log(`Sub-queries: ${doneCount}/${totalCount} done`);

    // If most are done or we've waited long enough, return
    if (doneCount >= totalCount * 0.7 || (doneCount > 0 && Date.now() - start > 12000)) {
      return data;
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  // Final attempt
  return await fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}`, token, 4000);
}

// ── Fetch REAL detailed results from correct API endpoints ──

async function fetchConsultaClienteDetails(
  token: string,
  clientId: string,
  queryId: string
): Promise<any> {
  console.log(`Fetching Consulta Cliente details: clientId=${clientId}, queryId=${queryId}`);

  // These are the REAL endpoints from the AgRisk API documentation
  const detailFetches = [
    { key: "compliance", fn: () => fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/compliance/${queryId}`, token, 8000) },
    { key: "bvs", fn: () => fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/bvs/${queryId}`, token, 8000) },
    { key: "lawsuits", fn: () => fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/lawsuits`, token, 8000) },
    { key: "groups_economic", fn: () => fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/groups/economic`, token, 5000) },
    { key: "groups_family", fn: () => fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/groups/family`, token, 5000) },
    { key: "bndes", fn: () => fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/bndes`, token, 5000) },
    { key: "contacts", fn: () => fetchJson(`${AGRISK_BASE}/v2/queries/clients/${clientId}/contacts`, token, 5000) },
  ];

  // Execute all in parallel
  const results = await Promise.all(
    detailFetches.map(async ({ key, fn }) => {
      try {
        const data = await fn();
        console.log(`${key}: ${data ? "OK" : "null"}`);
        return { key, data };
      } catch (e) {
        console.log(`${key}: error`, e);
        return { key, data: null };
      }
    })
  );

  const enrichedData: Record<string, any> = {};
  let hasRealData = false;

  for (const { key, data } of results) {
    if (data !== null) {
      enrichedData[key] = data;
      // Check if this contains actual useful data (not just empty objects)
      const str = JSON.stringify(data);
      if (str.length > 50) hasRealData = true;
    }
  }

  if (!hasRealData) {
    console.log("No real data found from any detail endpoint");
  }

  return { details: enrichedData, hasRealData };
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── GET: proxy file download ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const filePath = url.searchParams.get("file");
    if (!filePath) {
      return new Response("Missing file parameter", { status: 400, headers: corsHeaders });
    }
    try {
      const token = await agriskLogin();
      // Try multiple possible base URLs for AgRisk file storage
      const possibleUrls = [
        `${AGRISK_BASE}/files/${filePath}`,
        `${AGRISK_BASE}/certificates/${filePath}`,
        `${AGRISK_BASE}/v2/files/${filePath}`,
        `https://storage.googleapis.com/agrisk-prod.appspot.com/${filePath}`,
      ];
      
      let pdfRes: Response | null = null;
      for (const tryUrl of possibleUrls) {
        try {
          const res = await fetch(tryUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            pdfRes = res;
            console.log(`File found at: ${tryUrl}`);
            break;
          }
          console.log(`File not at: ${tryUrl} (${res.status})`);
        } catch {}
      }

      if (!pdfRes) {
        return new Response(JSON.stringify({ error: "Arquivo não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pdfBuffer = await pdfRes.arrayBuffer();
      return new Response(pdfBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="certificado.pdf"`,
        },
      });
    } catch (err) {
      console.error("File proxy error:", err);
      return new Response(JSON.stringify({ error: "Erro ao buscar arquivo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const body = await req.json();
    const { action, taxId, consultaType } = body;

    // ── Action: fetch-existing-details (reuse existing queryId, no new charge) ──
    if (action === "fetch-existing-details") {
      const { clientId, queryId } = body;
      if (!clientId || !queryId) {
        return new Response(JSON.stringify({ error: "clientId e queryId são obrigatórios." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = await agriskLogin();
      const { details, hasRealData } = await fetchConsultaClienteDetails(token, clientId, queryId);
      return new Response(JSON.stringify({ data: { details, hasRealData } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: list-products ──
    if (action === "list-products") {
      const token = await agriskLogin();
      const products = await listProducts(token);
      return new Response(JSON.stringify({ data: products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: register-client ──
    if (action === "register-client") {
      if (!taxId) {
        return new Response(JSON.stringify({ error: "taxId é obrigatório." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = await agriskLogin();
      const clientId = await getOrCreateClient(token, taxId.replace(/\D/g, ""));

      let clientData = null;
      try {
        const res = await fetch(`${AGRISK_BASE}/clients/client/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) clientData = await res.json();
      } catch {}

      let contacts = null;
      try {
        const res = await fetch(`${AGRISK_BASE}/v2/queries/clients/${clientId}/contacts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) contacts = await res.json();
      } catch {}

      return new Response(JSON.stringify({
        data: { clientId, clientData, contacts },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Default: execute query ──
    if (!taxId || !consultaType) {
      return new Response(JSON.stringify({ error: "taxId e consultaType são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productInfo = PRODUCT_MAP[consultaType];
    if (!productInfo) {
      return new Response(JSON.stringify({ error: `Tipo de consulta '${consultaType}' não suportado.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await agriskLogin();
    const clientId = await getOrCreateClient(token, taxId.replace(/\D/g, ""));
    const queryResult = await requestQuery(token, clientId, [productInfo._id]);

    console.log("Query result:", JSON.stringify(queryResult).slice(0, 500));

    const queryId = extractQueryId(queryResult);
    console.log(`Extracted queryId: ${queryId}`);

    if (consultaType === "consulta_cliente") {
      // Wait for sub-queries to process
      await waitForSubQueries(token, clientId, 20000);

      // Now fetch the REAL detailed data from correct endpoints
      const effectiveQueryId = queryId || "latest";
      const { details, hasRealData } = await fetchConsultaClienteDetails(token, clientId, effectiveQueryId);

      if (!hasRealData) {
        return new Response(JSON.stringify({
          error: "A consulta foi processada, mas os endpoints de detalhamento não retornaram dados úteis. Verifique se o CPF/CNPJ possui informações nos bureaus consultados.",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data: details }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Other query types ──
    // Wait briefly for processing
    await new Promise((r) => setTimeout(r, 5000));

    let resultData = null;

    switch (consultaType) {
      case "imoveis_simples": {
        if (queryId) {
          resultData = await fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/properties/${queryId}`, token, 8000);
          if (!resultData) {
            resultData = await fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/pesquisa-imoveis/${queryId}`, token, 8000);
          }
        }
        break;
      }
      case "imoveis_car": {
        if (queryId) {
          resultData = await fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/car/${queryId}`, token, 8000);
        }
        break;
      }
      case "patrimonio_veicular": {
        if (queryId) {
          resultData = await fetchJson(`${AGRISK_BASE}/queries/clients/${clientId}/vehicle-assets/${queryId}`, token, 8000);
        }
        break;
      }
    }

    if (!resultData) {
      return new Response(JSON.stringify({
        error: "Consulta enviada mas não foi possível obter os resultados detalhados.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: resultData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("AgRisk query error:", err);
    const message = err instanceof Error ? err.message : "Erro interno ao consultar AgRisk.";
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
