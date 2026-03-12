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

async function fetchJsonWithTimeout(url: string, token: string, timeoutMs = 2500): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

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
  if (existingId) {
    console.log(`Client found: ${existingId} for taxId ${taxId}`);
    return existingId;
  }

  console.log(`Client not found, creating for taxId ${taxId}`);
  const createRes = await fetch(`${AGRISK_BASE}/clients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ taxId }),
  });

  if (createRes.ok) {
    const data = await createRes.json();
    return data.id || data._id || data.clientId;
  }

  const errText = await createRes.text();
  console.error(`Create client failed (${createRes.status}): ${errText}`);
  
  try {
    const errData = JSON.parse(errText);
    if (errData.id || errData.clientId || errData._id) {
      return errData.id || errData.clientId || errData._id;
    }
  } catch {}

  throw new Error(`Não foi possível cadastrar ou encontrar o cliente com o documento informado.`);
}

async function requestQuery(token: string, clientId: string, productIds: string[]): Promise<any> {
  const res = await fetch(`${AGRISK_BASE}/queries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      clients: [clientId],
      products: productIds,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ao solicitar consulta (${res.status}): ${txt}`);
  }

  return await res.json();
}

async function pollForResults(token: string, clientId: string, maxWaitMs = 45000): Promise<any> {
  const start = Date.now();
  const interval = 3000;

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${AGRISK_BASE}/queries/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      const items = data.items || data;
      if (Array.isArray(items)) {
        const allDone = items.every((item: any) => item.status !== "pending" && item.status !== "processing");
        if (allDone) return items;
      } else {
        return data;
      }
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("Timeout aguardando resultado da consulta AgRisk. Tente novamente em alguns minutos.");
}

// Extract the flat sub-query map from various API response shapes
function extractSubQueries(data: any): Record<string, any> | null {
  if (data?.items && Array.isArray(data.items) && data.items[0]?.queries) {
    return data.items[0].queries;
  }
  if (data?.queries && typeof data.queries === 'object') {
    return data.queries;
  }
  const metaKeys = new Set(['queryId', 'status', 'id', '_id', 'message', 'items', 'statusCode']);
  const keys = Object.keys(data || {}).filter(k => !metaKeys.has(k));
  if (keys.length > 3) {
    const result: Record<string, any> = {};
    for (const k of keys) result[k] = data[k];
    return result;
  }
  return null;
}

// For consulta_cliente: poll status then fetch detailed results for each completed sub-query
async function pollConsultaCliente(token: string, clientId: string, queryId: string, maxWaitMs = 25000): Promise<any> {
  const start = Date.now();
  const hardDeadline = start + maxWaitMs;
  const interval = 2500;

  await new Promise((r) => setTimeout(r, 1500));

  let subQueries: Record<string, any> | null = null;

  while (Date.now() < hardDeadline) {
    const endpoints = [
      `/queries/clients/${clientId}/consulta-cliente/${queryId}`,
      `/queries/clients/${clientId}/bvs/${queryId}`,
      `/queries/clients/${clientId}/${queryId}`,
    ];

    for (const path of endpoints) {
      const data = await fetchJsonWithTimeout(`${AGRISK_BASE}${path}`, token, 3000);
      if (!data) continue;

      const sq = extractSubQueries(data);
      if (!sq) continue;

      const keys = Object.keys(sq);
      if (keys.length === 0) continue;

      const doneCount = keys.filter((k) => {
        const val = sq[k];
        const item = Array.isArray(val) ? val[0] : val;
        const s = (item?.status || "").toUpperCase();
        return ["DONE", "SUCCESS", "COMPLETED", "FINALIZADO"].includes(s);
      }).length;

      const pendingCount = keys.length - doneCount;
      console.log(`Consulta cliente: ${doneCount}/${keys.length} done from ${path}`);

      if (doneCount > 0 || pendingCount === 0 || Date.now() - start > 16000) {
        subQueries = sq;
        break;
      }
    }

    if (subQueries) break;
    await new Promise((r) => setTimeout(r, interval));
  }

  if (!subQueries) {
    console.log("Polling timeout, fetching last state...");
    for (const path of [
      `/queries/clients/${clientId}/consulta-cliente/${queryId}`,
      `/queries/clients/${clientId}/bvs/${queryId}`,
      `/queries/clients/${clientId}`,
    ]) {
      const data = await fetchJsonWithTimeout(`${AGRISK_BASE}${path}`, token, 2500);
      if (!data) continue;
      subQueries = extractSubQueries(data);
      if (subQueries) break;
    }
  }

  if (!subQueries) {
    return { message: "Consulta enviada. Os resultados podem demorar para serem processados." };
  }

  const subKeys = Object.keys(subQueries);
  const enrichedData: Record<string, any> = {};
  const detailDeadline = Date.now() + 12000;

  const batchSize = 6;
  for (let i = 0; i < subKeys.length; i += batchSize) {
    if (Date.now() > detailDeadline) break;

    const batch = subKeys.slice(i, i + batchSize);
    await Promise.all(batch.map(async (key) => {
      const val = subQueries![key];
      const item = Array.isArray(val) ? val[0] : val;
      const s = (item?.status || "").toUpperCase();
      const isDone = ["DONE", "SUCCESS", "COMPLETED", "FINALIZADO"].includes(s);

      if (!isDone) {
        enrichedData[key] = val;
        return;
      }

      const detailPaths = [
        `/queries/clients/${clientId}/consulta-cliente/${queryId}/${key}`,
        `/queries/clients/${clientId}/bvs/${queryId}/${key}`,
      ];

      for (const path of detailPaths) {
        if (Date.now() > detailDeadline) break;

        const detail = await fetchJsonWithTimeout(`${AGRISK_BASE}${path}`, token, 2000);
        if (detail) {
          enrichedData[key] = Array.isArray(val)
            ? [{ ...val[0], result: detail }]
            : { ...val, result: detail };
          return;
        }
      }

      enrichedData[key] = val;
    }));
  }

  for (const key of subKeys) {
    if (!(key in enrichedData)) enrichedData[key] = subQueries[key];
  }

  return enrichedData;
}

async function fetchResultByType(
  token: string,
  clientId: string,
  consultaType: string,
  queryItems: any[]
): Promise<any> {
  const productCode = PRODUCT_MAP[consultaType]?.code;

  const relevantItem = queryItems.find(
    (item: any) => item.productCode === productCode || item.product?.code === productCode || item.code === productCode
  );
  const queryId = relevantItem?.queryId || relevantItem?.id || relevantItem?._id;

  console.log(`fetchResultByType: type=${consultaType}, productCode=${productCode}, queryId=${queryId}`);
  console.log(`queryItems:`, JSON.stringify(queryItems).slice(0, 500));

  const tryEndpoints = async (paths: string[]): Promise<any> => {
    for (const path of paths) {
      try {
        console.log(`Trying endpoint: ${path}`);
        const res = await fetch(`${AGRISK_BASE}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`Success from ${path}:`, JSON.stringify(data).slice(0, 300));
          return data;
        }
        console.log(`Endpoint ${path} returned ${res.status}`);
      } catch (e) {
        console.log(`Endpoint ${path} failed:`, e);
      }
    }
    return null;
  };

  switch (consultaType) {
    case "consulta_cliente": {
      const paths = queryId
        ? [
            `/queries/clients/${clientId}/consulta-cliente/${queryId}`,
            `/queries/clients/${clientId}/bvs/${queryId}`,
            `/queries/clients/${clientId}/${queryId}`,
            `/queries/${queryId}`,
          ]
        : [];
      
      paths.push(`/queries/clients/${clientId}`);
      
      const result = await tryEndpoints(paths);
      if (result) return result;
      
      return relevantItem || { message: "Consulta processada, dados não encontrados no endpoint esperado." };
    }

    case "imoveis_simples": {
      if (!queryId) return relevantItem || { message: "Consulta processada, sem queryId disponível." };
      const result = await tryEndpoints([
        `/queries/clients/${clientId}/properties/${queryId}`,
        `/queries/clients/${clientId}/pesquisa-imoveis/${queryId}`,
      ]);
      return result || relevantItem || {};
    }

    case "imoveis_car": {
      if (!queryId) return relevantItem || { message: "Consulta processada, sem queryId disponível." };
      const result = await tryEndpoints([
        `/queries/clients/${clientId}/car/${queryId}`,
      ]);
      return result || relevantItem || {};
    }

    case "patrimonio_veicular": {
      if (!queryId) return relevantItem || { message: "Consulta processada, sem queryId disponível." };
      const result = await tryEndpoints([
        `/queries/clients/${clientId}/vehicle-assets/${queryId}`,
      ]);
      return result || relevantItem || {};
    }

    default:
      return relevantItem || {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, taxId, consultaType } = body;

    // ── Action: list-products ──
    if (action === "list-products") {
      const token = await agriskLogin();
      const products = await listProducts(token);
      return new Response(JSON.stringify({ data: products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: register-client ──
    // Only registers client + fetches free cadastral data (no paid queries)
    if (action === "register-client") {
      if (!taxId) {
        return new Response(JSON.stringify({ error: "taxId é obrigatório." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = await agriskLogin();
      const clientId = await getOrCreateClient(token, taxId.replace(/\D/g, ""));

      // Fetch client cadastral data (free GET)
      let clientData = null;
      try {
        const res = await fetch(`${AGRISK_BASE}/clients/client/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) clientData = await res.json();
      } catch {}

      // Fetch contacts (free GET)
      let contacts = null;
      try {
        const res = await fetch(`${AGRISK_BASE}/v2/queries/clients/${clientId}/contacts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) contacts = await res.json();
      } catch {}

      return new Response(JSON.stringify({
        data: {
          clientId,
          clientData,
          contacts,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Default action: single query ──
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

    // For consulta_cliente, use specific polling with queryId
    if (consultaType === "consulta_cliente") {
      // Extract queryId from various response shapes
      let effectiveQueryId = queryResult?.queryId || queryResult?.id || queryResult?._id;
      // Check items array: { items: [{ queryId: "..." }] }
      if (!effectiveQueryId && queryResult?.items?.[0]?.queryId) {
        effectiveQueryId = queryResult.items[0].queryId;
      }
      // Check nested arrays
      if (!effectiveQueryId) {
        const firstKey = Object.keys(queryResult || {}).find(k => Array.isArray(queryResult[k]));
        effectiveQueryId = firstKey ? queryResult[firstKey]?.[0]?.queryId : null;
      }

      if (effectiveQueryId) {
        console.log(`Using consulta_cliente polling with queryId: ${effectiveQueryId}`);
        const resultData = await pollConsultaCliente(token, clientId, effectiveQueryId, 25000);
        return new Response(JSON.stringify({ data: resultData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const pollResults = await pollForResults(token, clientId);
    console.log("Poll results:", JSON.stringify(pollResults).slice(0, 500));

    const resultData = await fetchResultByType(token, clientId, consultaType, Array.isArray(pollResults) ? pollResults : [pollResults]);

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
