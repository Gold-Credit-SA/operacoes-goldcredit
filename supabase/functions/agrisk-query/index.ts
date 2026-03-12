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

async function getOrCreateClient(token: string, taxId: string): Promise<string> {
  // Try to create client
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

  // If 400, client may already exist — extract id from response
  if (createRes.status === 400) {
    const errData = await createRes.json();
    if (errData.id || errData.clientId || errData._id) {
      return errData.id || errData.clientId || errData._id;
    }
    // Search in client list
    const listRes = await fetch(`${AGRISK_BASE}/v2/clients?filter=all&page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const items = listData.items || listData;
      if (Array.isArray(items)) {
        const found = items.find((c: any) => c.taxId?.replace(/\D/g, "") === taxId.replace(/\D/g, ""));
        if (found) return found.id || found._id;
      }
    }
    throw new Error(errData.message || "Cliente já cadastrado mas não foi possível obter o ID.");
  }

  const txt = await createRes.text();
  throw new Error(`Erro ao cadastrar cliente (${createRes.status}): ${txt}`);
}

async function getProducts(token: string): Promise<any[]> {
  const res = await fetch(`${AGRISK_BASE}/login`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
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
  // Find the relevant query item for this product
  const productCode = PRODUCT_MAP[consultaType];

  // Try to find queryId in the polling results
  const relevantItem = queryItems.find(
    (item: any) => item.productCode === productCode || item.product?.code === productCode || item.code === productCode
  );
  const queryId = relevantItem?.queryId || relevantItem?.id || relevantItem?._id;

  switch (consultaType) {
    case "consulta_cliente": {
      // Client data is usually in the query result itself or client endpoint
      const res = await fetch(`${AGRISK_BASE}/v2/clients?filter=all&page=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data;
        if (Array.isArray(items)) {
          const client = items.find((c: any) => c.id === clientId || c._id === clientId);
          if (client) return client;
        }
      }
      // Fallback: return polling item data
      return relevantItem || { message: "Dados do cliente consultados com sucesso." };
    }

    case "imoveis_simples": {
      if (!queryId) return relevantItem || { message: "Consulta processada, sem queryId disponível." };
      const res = await fetch(`${AGRISK_BASE}/queries/clients/${clientId}/properties/${queryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
      // Try alternative endpoint
      const res2 = await fetch(`${AGRISK_BASE}/queries/clients/${clientId}/pesquisa-imoveis/${queryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res2.ok) return await res2.json();
      return relevantItem || {};
    }

    case "imoveis_car": {
      if (!queryId) return relevantItem || { message: "Consulta processada, sem queryId disponível." };
      const res = await fetch(`${AGRISK_BASE}/queries/clients/${clientId}/car/${queryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
      return relevantItem || {};
    }

    case "patrimonio_veicular": {
      if (!queryId) return relevantItem || { message: "Consulta processada, sem queryId disponível." };
      const res = await fetch(`${AGRISK_BASE}/queries/clients/${clientId}/vehicle-assets/${queryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
      return relevantItem || {};
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
