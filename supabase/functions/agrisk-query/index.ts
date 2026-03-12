import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGRISK_BASE = "https://api.agrisk.digital";

// Map frontend consulta IDs to AgRisk product codes and IDs
const PRODUCT_MAP: Record<string, { code: string; _id: string }> = {
  consulta_cliente: { code: "consulta-cliente", _id: "Y9kboNavmB0DjJGxAVWn" },
  imoveis_simples: { code: "pesquisa-imoveis", _id: "9Z6kr6GlVG6n6fM7k7Yb" },
  imoveis_car: { code: "car", _id: "d9e66bd5-300a-49dd-ab49-9133dcccab96" },
  patrimonio_veicular: { code: "vehicle-assets", _id: "8a6dd886-902c-4745-a8e0-e81db1e10e93" },
};

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

async function findClientByTaxId(token: string, taxId: string): Promise<string | null> {
  // Search across multiple pages
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
  // 1. First try to find existing client
  const existingId = await findClientByTaxId(token, taxId);
  if (existingId) {
    console.log(`Client found: ${existingId} for taxId ${taxId}`);
    return existingId;
  }

  // 2. Client not found, create new one
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

  // If creation fails, try to parse error for client ID
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

async function fetchResultByType(
  token: string,
  clientId: string,
  consultaType: string,
  queryItems: any[]
): Promise<any> {
  const productCode = PRODUCT_MAP[consultaType]?.code;

  // Find the relevant query item for this product
  const relevantItem = queryItems.find(
    (item: any) => item.productCode === productCode || item.product?.code === productCode || item.code === productCode
  );
  const queryId = relevantItem?.queryId || relevantItem?.id || relevantItem?._id;

  console.log(`fetchResultByType: type=${consultaType}, productCode=${productCode}, queryId=${queryId}`);
  console.log(`queryItems:`, JSON.stringify(queryItems).slice(0, 500));

  // Try multiple possible endpoints for the query result
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
      // The actual query result should be fetched from the query endpoint, not the client list
      const paths = queryId
        ? [
            `/queries/clients/${clientId}/consulta-cliente/${queryId}`,
            `/queries/clients/${clientId}/bvs/${queryId}`,
            `/queries/clients/${clientId}/${queryId}`,
            `/queries/${queryId}`,
          ]
        : [];
      
      // Also try fetching all query results for this client
      paths.push(`/queries/clients/${clientId}`);
      
      const result = await tryEndpoints(paths);
      if (result) return result;
      
      // Fallback: return the polling item itself which may contain embedded data
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
    const { taxId, consultaType } = await req.json();

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

    // 1. Login
    const token = await agriskLogin();

    // 2. Get or create client
    const clientId = await getOrCreateClient(token, taxId.replace(/\D/g, ""));

    // 3. Request query with hardcoded product ID
    const queryResult = await requestQuery(token, clientId, [productInfo._id]);

    // 5. Poll for results
    const pollResults = await pollForResults(token, clientId);

    // 6. Fetch specific results
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
