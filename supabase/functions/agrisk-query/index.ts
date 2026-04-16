import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGRISK_BASE = "https://api.agrisk.digital";
const POLL_DELAY_MS = 3000;
const POLL_ATTEMPTS = 12;

type ConsultaType =
  | "consulta_cliente"
  | "restritivos"
  | "endividamento"
  | "cpr"
  | "imoveis_simples"
  | "imoveis_car"
  | "patrimonio_veicular"
  | "armazens";

type Product = {
  _id?: string;
  id?: string;
  code?: string;
  name?: string;
  price?: number;
};

type QueryRef = {
  serviceKey: string;
  queryId: string;
  status?: string;
};

type TryJsonResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

const PRODUCT_HINTS: Record<ConsultaType, string[]> = {
  consulta_cliente: ["consulta-cliente", "consulta cliente"],
  restritivos: ["credit-restrictive", "restritivo nacional", "restritivo"],
  endividamento: ["scr", "endividamento"],
  cpr: ["cpr"],
  imoveis_simples: ["pesquisa-imoveis", "imoveis rurais - simples", "rural simples"],
  imoveis_car: ["car", "cadastro ambiental rural", "imoveis rurais - car"],
  patrimonio_veicular: ["vehicle-assets", "veicular", "patrimonio veicular"],
  armazens: ["armazem", "armazens", "warehouse", "conab", "silo", "armazéns", "registered-warehouses"],
};

// Service keys each consulta type needs — empty = wait for all
const RELEVANT_SERVICES: Record<ConsultaType, string[]> = {
  consulta_cliente: [],
  restritivos: ["credit-restrictive", "credit-restrictives", "restritivo"],
  endividamento: ["scr", "endividamento"],
  cpr: ["cpr", "cerc-publicidade"],
  imoveis_simples: ["pesquisa-imoveis"],
  imoveis_car: ["car"],
  patrimonio_veicular: ["vehicle-assets"],
  armazens: ["registered-warehouses", "armazem", "armazens"],
};

const KNOWN_QUERY_SERVICES = [
  {
    outputKey: "compliance",
    matchers: ["compliance", "kyc"],
    getPath: (clientId: string, queryId: string) => `/queries/clients/${clientId}/compliance/${queryId}`,
  },
  {
    outputKey: "bvs",
    matchers: ["bvs", "boa-vista", "boa vista"],
    getPath: (clientId: string, queryId: string) => `/queries/clients/${clientId}/bvs/${queryId}`,
  },
  {
    outputKey: "restritivos",
    matchers: ["credit-restrictive", "credit restrictive", "credit-restrictives-fif-pf", "restritivo"],
    getPath: (clientId: string, queryId: string) => `/queries/clients/${clientId}/credit-restrictive/${queryId}`,
  },
  {
    outputKey: "scr",
    matchers: ["scr", "endividamento"],
    getPath: (clientId: string, queryId: string) => `/queries/clients/${clientId}/scr/${queryId}`,
  },
  {
    outputKey: "cpr",
    matchers: ["cpr"],
    getPath: (clientId: string, queryId: string) => `/queries/clients/${clientId}/cpr/${queryId}`,
  },
  {
    outputKey: "protests",
    matchers: ["protests", "protestos", "protest"],
    getPath: (clientId: string, queryId: string) => `/queries/clients/${clientId}/protests/${queryId}`,
  },
  {
    outputKey: "quod",
    matchers: ["quod"],
    getPath: (clientId: string, queryId: string) => `/queries/clients/${clientId}/quod/${queryId}`,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return await handleFileProxy(req);
  }

  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === "list-products") {
      const token = await agriskLogin();
      const products = await listProducts(token);
      return json({ ok: true, data: products });
    }

    if (action === "register-client") {
      return await handleRegisterClient(body);
    }

    if (action === "fetch-existing-details") {
      return await handleFetchExistingDetails(body);
    }

    if (action === "fetch-lawsuit-detail") {
      return await handleFetchLawsuitDetail(body);
    }

    return await handleConsulta(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao consultar AgRisk.";
    console.error("[agrisk-query] error:", message, error);
    return json({ ok: false, error: message });
  }
});

async function handleFileProxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filePath = url.searchParams.get("file");

  if (!filePath) {
    return json({ ok: false, error: "Missing file parameter" });
  }

  try {
    const token = await agriskLogin();
    const possibleUrls = [
      `${AGRISK_BASE}/files/${filePath}`,
      `${AGRISK_BASE}/certificates/${filePath}`,
      `${AGRISK_BASE}/v2/files/${filePath}`,
      `https://storage.googleapis.com/agrisk-prod.appspot.com/${filePath}`,
    ];

    for (const tryUrl of possibleUrls) {
      try {
        const res = await fetch(tryUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;

        const pdfBuffer = await res.arrayBuffer();
        return new Response(pdfBuffer, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="certificado.pdf"',
          },
        });
      } catch {
        // try next url
      }
    }

    return json({ ok: false, error: "Arquivo nao encontrado" });
  } catch (error) {
    console.error("[agrisk-query] file proxy error:", error);
    return json({ ok: false, error: "Erro ao buscar arquivo" });
  }
}

async function handleRegisterClient(body: Record<string, unknown>): Promise<Response> {
  const taxId = sanitizeTaxId(body?.taxId);
  if (!taxId) {
    return json({ ok: false, error: "taxId e obrigatorio." });
  }

  const token = await agriskLogin();
  const clientId = await getOrCreateClient(token, taxId);

  const [clientDataResult, contactsResult] = await Promise.all([
    tryJson(`${AGRISK_BASE}/clients/client/${clientId}`, token, 6000),
    tryJson(`${AGRISK_BASE}/v2/queries/clients/${clientId}/contacts`, token, 6000),
  ]);

  return json({
    ok: true,
    data: {
      clientId,
      clientData: clientDataResult.data,
      contacts: contactsResult.data,
    },
  });
}

async function handleFetchExistingDetails(body: Record<string, unknown>): Promise<Response> {
  const clientId = asString(body?.clientId);
  const queryId = asString(body?.queryId);

  if (!clientId) {
    return json({ ok: false, error: "clientId e obrigatorio." });
  }

  const token = await agriskLogin();
  const queryRefs = await waitForQueryRefs(token, clientId);
  const details = await fetchConsultaClienteDetails(token, clientId, queryRefs, queryId);

  return json({ ok: true, data: details });
}

async function handleFetchLawsuitDetail(body: Record<string, unknown>): Promise<Response> {
  const clientId = asString(body?.clientId);
  const lawsuitId = asString(body?.lawsuitId);

  if (!clientId || !lawsuitId) {
    return json({
      ok: false,
      data: null,
      error: "clientId e lawsuitId sao obrigatorios.",
    });
  }

  const token = await agriskLogin();
  const detail = await fetchLawsuitDetail(token, clientId, lawsuitId);

  if (!detail) {
    return json({
      ok: false,
      data: null,
      error: "Nao foi possivel carregar o detalhe do processo.",
    });
  }

  console.log(`[handleFetchLawsuitDetail] returning detail: _id=${asString(detail._id)} Updates=${Array.isArray(detail.Updates) ? detail.Updates.length : "none"} keys=${Object.keys(detail).join(",")}`);
  return json({ ok: true, data: detail });
}

async function handleConsulta(body: Record<string, unknown>): Promise<Response> {
  const taxId = sanitizeTaxId(body?.taxId);
  const consultaType = asConsultaType(body?.consultaType);

  if (!taxId || !consultaType) {
    return json({ ok: false, error: "taxId e consultaType sao obrigatorios." });
  }

  const token = await agriskLogin();
  const clientId = await getOrCreateClient(token, taxId);
  const products = await listProducts(token);
  const product = findBestProduct(products, PRODUCT_HINTS[consultaType]);

  if (!product) {
    return json({
      ok: false,
      error: `Nenhum produto AgRisk compativel encontrado para '${consultaType}'.`,
    });
  }

  const productId = product._id || product.id;
  if (!productId) {
    return json({
      ok: false,
      error: `Produto AgRisk sem identificador para '${consultaType}'.`,
    });
  }

  const queryRequest = await requestQuery(token, clientId, [productId]);
  const initialRefs = extractQueryRefs(queryRequest);
  const relevantKeys = RELEVANT_SERVICES[consultaType];
  const queryRefs = await waitForQueryRefs(token, clientId, initialRefs, relevantKeys);

  let resultData: Record<string, unknown> | null = null;

  switch (consultaType) {
    case "consulta_cliente":
      resultData = await fetchConsultaClienteDetails(token, clientId, queryRefs);
      break;
    case "restritivos":
      resultData = await fetchRestritivos(token, clientId, queryRefs);
      break;
    case "endividamento":
      resultData = await fetchEndividamento(token, clientId, queryRefs);
      break;
    case "cpr":
      resultData = await fetchCpr(token, clientId, queryRefs);
      break;
    case "imoveis_simples":
      resultData = await fetchImoveisSimples(token, clientId);
      break;
    case "imoveis_car":
      resultData = await fetchImoveisCar(token, clientId, queryRefs);
      break;
    case "patrimonio_veicular":
      resultData = await fetchPatrimonioVeicular(token, queryRefs);
      break;
    case "armazens":
      resultData = await fetchArmazens(token, clientId, queryRefs);
      break;
  }

  if (!resultData) {
    return json({
      ok: false,
      error: "Consulta enviada, mas nao foi possivel obter os resultados detalhados.",
      diagnostics: { clientId, consultaType, queryRefsCount: queryRefs.length },
    });
  }

  const responseDetails = consultaType === "consulta_cliente"
    ? resultData
    : { details: resultData };

  return json({
    ok: true,
    data: {
      clientId,
      product: {
        id: productId,
        code: product.code || null,
        name: product.name || null,
        price: product.price ?? null,
      },
      queryRefs,
      result: resultData,
      ...responseDetails,
    },
  });
}

async function agriskLogin(): Promise<string> {
  const credential = Deno.env.get("AGRISK_CREDENTIAL");
  const password = Deno.env.get("AGRISK_PASSWORD");

  if (!credential || !password) {
    throw new Error("Credenciais AgRisk nao configuradas.");
  }

  const res = await fetch(`${AGRISK_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, password }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Falha no login AgRisk (${res.status}): ${text}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Resposta invalida do login AgRisk.");
  }

  if (typeof data.token !== "string" || !data.token) {
    throw new Error("Token nao retornado no login AgRisk.");
  }

  return data.token;
}

async function listProducts(token: string): Promise<Product[]> {
  const result = await tryJson<{ items?: Product[] }>(`${AGRISK_BASE}/v2/products`, token, 8000);
  if (!result.ok || !result.data) {
    throw new Error(result.error || "Erro ao listar produtos AgRisk.");
  }

  if (Array.isArray(result.data)) {
    return result.data as unknown as Product[];
  }

  return Array.isArray(result.data.items) ? result.data.items : [];
}

function findBestProduct(products: Product[], hints: string[]): Product | null {
  const normalizedHints = hints.map(normalizeText);

  const ranked = products
    .map((product) => {
      const haystack = normalizeText(`${product.code || ""} ${product.name || ""}`);
      let score = 0;

      for (const hint of normalizedHints) {
        if (haystack === hint) score += 100;
        else if (haystack.includes(hint)) score += 20 + hint.length;
      }

      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.product || null;
}

async function getOrCreateClient(token: string, taxId: string): Promise<string> {
  console.log(`[getOrCreateClient] searching for taxId=${taxId}`);
  const existing = await findClientByTaxId(token, taxId);
  if (existing) {
    console.log(`[getOrCreateClient] found existing client: ${existing}`);
    return existing;
  }

  console.log(`[getOrCreateClient] not found, creating new client...`);
  const res = await fetch(`${AGRISK_BASE}/clients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ taxId }),
  });

  const text = await res.text();
  console.log(`[getOrCreateClient] POST /clients status=${res.status} body=${text.substring(0, 500)}`);
  
  let data: Record<string, unknown> | null = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (res.ok && data) {
    const id = asString(data.id) || asString(data._id) || asString(data.clientId);
    if (id) return id;
  }

  // Try to extract clientId from error response (duplicate client)
  const duplicateId =
    (data && (asString(data.clientId) || asString(data.id) || asString(data._id))) || extractClientIdFromText(text);
  if (duplicateId) {
    console.log(`[getOrCreateClient] found duplicate clientId: ${duplicateId}`);
    return duplicateId;
  }

  // Last resort: check if error message contains useful info
  const rawMsg = data?.message;
  const errorMsg = Array.isArray(rawMsg) ? rawMsg.join('; ') : (asString(rawMsg) || asString(data?.error) || text);
  console.error(`[getOrCreateClient] failed to create/find client. Error: ${errorMsg}`);
  throw new Error(errorMsg || 'Nao foi possivel cadastrar o cliente no AgRisk.');
}

async function findClientByTaxId(token: string, taxId: string): Promise<string | null> {
  // 1) Busca direta por taxId (evita paginar tudo)
  const directSearchUrls = [
    `${AGRISK_BASE}/v2/clients?taxId=${taxId}&filter=all`,
    `${AGRISK_BASE}/v2/clients?search=${taxId}&filter=all`,
    `${AGRISK_BASE}/v2/clients?document=${taxId}&filter=all`,
    `${AGRISK_BASE}/clients?taxId=${taxId}`,
  ];

  for (const searchUrl of directSearchUrls) {
    const result = await tryJson<{ items?: Record<string, unknown>[]; _id?: string; id?: string }>(
      searchUrl,
      token,
      8000,
    );

    if (result.ok && result.data) {
      const singleId =
        asString((result.data as Record<string, unknown>)._id) ||
        asString((result.data as Record<string, unknown>).id);
      if (singleId) {
        console.log(`[findClientByTaxId] found via direct search at ${searchUrl}: ${singleId}`);
        return singleId;
      }

      const items = Array.isArray(result.data.items) ? result.data.items : [];
      const found = items.find((client) => {
        const clientTaxId =
          sanitizeTaxId(client.taxId) ||
          sanitizeTaxId(client.document) ||
          sanitizeTaxId(client.cpf) ||
          sanitizeTaxId(client.cnpj);
        return clientTaxId === taxId;
      });

      if (found) {
        const id = asString(found._id) || asString(found.id);
        if (id) {
          console.log(`[findClientByTaxId] found via search items at ${searchUrl}: ${id}`);
          return id;
        }
      }
    }
  }

  // 2) Fallback: paginação completa (limite aumentado para 200)
  let page = 1;
  let hasNextPage = true;
  const MAX_PAGES = 200;

  while (hasNextPage && page <= MAX_PAGES) {
    const result = await tryJson<{ items?: Record<string, unknown>[]; nextPage?: boolean }>(
      `${AGRISK_BASE}/v2/clients?filter=all&page=${page}`,
      token,
      8000,
    );

    if (!result.ok || !result.data) {
      break;
    }

    const items = Array.isArray(result.data.items) ? result.data.items : [];
    const found = items.find((client) => {
      const clientTaxId =
        sanitizeTaxId(client.taxId) ||
        sanitizeTaxId(client.document) ||
        sanitizeTaxId(client.cpf) ||
        sanitizeTaxId(client.cnpj);
      return clientTaxId === taxId;
    });

    if (found) {
      const id = asString(found._id) || asString(found.id);
      if (id) {
        console.log(`[findClientByTaxId] found via pagination page=${page}: ${id}`);
        return id;
      }
    }

    hasNextPage = Boolean(result.data.nextPage);
    page += 1;
  }

  console.log(`[findClientByTaxId] not found for taxId=${taxId} after ${page - 1} pages`);
  return null;
}

function extractClientIdFromText(text: string): string | null {
  const match = text.match(/"clientId"\s*:\s*"([^"]+)"/i);
  return match?.[1] || null;
}

async function requestQuery(token: string, clientId: string, productIds: string[]): Promise<unknown> {
  const res = await fetch(`${AGRISK_BASE}/queries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ clients: [clientId], products: productIds }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Erro ao solicitar consulta AgRisk (${res.status}): ${text}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function extractQueryRefs(payload: unknown): QueryRef[] {
  const refs: QueryRef[] = [];
  walkQueryPayload(payload, refs);

  const byKey = new Map<string, QueryRef>();
  for (const ref of refs) {
    const current = byKey.get(ref.serviceKey);
    if (!current || current.queryId !== ref.queryId) {
      byKey.set(ref.serviceKey, ref);
    }
  }

  return Array.from(byKey.values());
}

function walkQueryPayload(payload: unknown, refs: QueryRef[], serviceKey?: string): void {
  if (!payload || typeof payload !== "object") {
    return;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      walkQueryPayload(item, refs, serviceKey);
    }
    return;
  }

  const record = payload as Record<string, unknown>;
  const queryId = asString(record.queryId);
  const status = asString(record.status) || undefined;

  if (queryId && serviceKey) {
    refs.push({ serviceKey, queryId, status });
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "queries" && value && typeof value === "object") {
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        walkQueryPayload(innerValue, refs, innerKey);
      }
      continue;
    }

    if (Array.isArray(value)) {
      walkQueryPayload(value, refs, key);
      continue;
    }

    if (value && typeof value === "object") {
      walkQueryPayload(value, refs, serviceKey);
    }
  }
}

async function waitForQueryRefs(
  token: string,
  clientId: string,
  initialRefs: QueryRef[] = [],
  relevantKeys: string[] = [],
): Promise<QueryRef[]> {
  const merged = new Map<string, QueryRef>();
  for (const ref of initialRefs) {
    merged.set(ref.serviceKey, ref);
  }

  const normalizedRelevant = relevantKeys.map(normalizeText);
  const hasFilter = normalizedRelevant.length > 0;

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const result = await tryJson<Record<string, unknown>>(`${AGRISK_BASE}/queries/clients/${clientId}`, token, 8000);

    if (result.ok && result.data) {
      const refs = extractQueryRefs(result.data);
      for (const ref of refs) {
        merged.set(ref.serviceKey, ref);
      }

      const allRefs = Array.from(merged.values());

      // If we have a filter, only check relevant services
      const refsToCheck = hasFilter
        ? allRefs.filter((ref) => normalizedRelevant.some((k) => normalizeText(ref.serviceKey).includes(k)))
        : allRefs;

      const pendingRefs = refsToCheck.filter((ref) => isPendingStatus(ref.status));
      const totalPending = allRefs.filter((ref) => isPendingStatus(ref.status)).length;

      console.log(
        `[waitForQueryRefs] attempt=${attempt + 1}/${POLL_ATTEMPTS} total=${allRefs.length} ` +
        `relevant=${refsToCheck.length} relevantPending=${pendingRefs.length} totalPending=${totalPending}` +
        (pendingRefs.length > 0 ? ` waiting=[${pendingRefs.map((r) => `${r.serviceKey}:${r.status}`).join(", ")}]` : ""),
      );

      if (refsToCheck.length > 0 && pendingRefs.length === 0) {
        console.log(`[waitForQueryRefs] relevant services ready, proceeding (${totalPending} unrelated still pending)`);
        break;
      }
    }

    if (attempt < POLL_ATTEMPTS - 1) {
      await sleep(POLL_DELAY_MS);
    }
  }

  return Array.from(merged.values());
}

async function fetchConsultaClienteDetails(
  token: string,
  clientId: string,
  queryRefs: QueryRef[],
  fallbackQueryId?: string | null,
): Promise<Record<string, unknown>> {
  const details: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  const baseFetches = [
    { key: "clientData", path: `/clients/client/${clientId}` },
    { key: "contacts", path: `/v2/queries/clients/${clientId}/contacts` },
    { key: "bndes", path: `/queries/clients/${clientId}/bndes` },
    { key: "groups_economic", path: `/queries/clients/${clientId}/groups/economic` },
    { key: "groups_family", path: `/queries/clients/${clientId}/groups/family` },
    { key: "lawsuits", path: `/queries/clients/${clientId}/lawsuits` },
    { key: "sintegra", path: `/queries/clients/${clientId}/sintegra` },
  ];

  await Promise.all(
    baseFetches.map(async ({ key, path }) => {
      const result = await tryJson(`${AGRISK_BASE}${path}`, token, 9000);
      if (result.ok && result.data) {
        details[key] = result.data;
      } else if (result.error) {
        errors[key] = result.error;
      }
    }),
  );

  for (const config of KNOWN_QUERY_SERVICES) {
    const ref = findQueryRef(queryRefs, config.matchers);
    const queryId = ref?.queryId || fallbackQueryId || null;
    if (!queryId) continue;

    const data = await pollForReadyData(
      () => tryJson(`${AGRISK_BASE}${config.getPath(clientId, queryId)}`, token, 12000),
      isReadyResult,
    );

    if (!data) continue;

    if (config.outputKey === "cpr") {
      details[config.outputKey] = await enrichCprDetails(token, clientId, data as Record<string, unknown>);
    } else {
      details[config.outputKey] = data;
    }
  }

  // Fallback compliance para PF quando nao vem via queryRefs
  if (!details.compliance) {
    const complianceFallback = await tryJson(`${AGRISK_BASE}/queries/clients/${clientId}/compliance`, token, 10000);
    if (complianceFallback.ok && complianceFallback.data) {
      details.compliance = complianceFallback.data;
    }
  }

  // Normaliza compliance: unwrap item/data se necessario
  if (details.compliance && typeof details.compliance === "object") {
    const comp = details.compliance as Record<string, unknown>;
    const inner = (comp.item || comp.data || comp) as Record<string, unknown>;
    if (inner !== comp) {
      details.compliance = inner;
    }
  }

  const hasRealData = Object.values(details).some((value) => {
    const text = JSON.stringify(value);
    return text.length > 50 && text !== "{}" && text !== "[]";
  });

  return {
    details,
    errors,
    queryRefs,
    hasRealData,
  };
}

async function fetchLawsuitDetail(
  token: string,
  clientId: string,
  lawsuitId: string,
): Promise<Record<string, unknown> | null> {
  const url = `${AGRISK_BASE}/queries/clients/${clientId}/lawsuits/${lawsuitId}`;
  console.log(`[fetchLawsuitDetail] GET ${url}`);

  let lastDetail: Record<string, unknown> | null = null;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = await tryJson<Record<string, unknown>>(url, token, 15000);

    console.log(`[fetchLawsuitDetail] attempt=${attempt} status=${result.status} ok=${result.ok} error=${result.error ?? "none"}`);

    if (result.ok && result.data && typeof result.data === "object") {
      const unwrapped = unwrapLawsuitResponse(result.data);
      console.log(`[fetchLawsuitDetail] unwrapped keys=${Object.keys(unwrapped).join(",")}`);
      console.log(`[fetchLawsuitDetail] Updates length=${Array.isArray(unwrapped.Updates) ? unwrapped.Updates.length : "none"}`);

      lastDetail = await enrichLawsuitMovements(token, unwrapped);

      if (hasLawsuitTimeline(lastDetail)) {
        console.log(`[fetchLawsuitDetail] timeline found on attempt=${attempt}, returning`);
        return lastDetail;
      }
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(POLL_DELAY_MS);
    }
  }

  console.log(`[fetchLawsuitDetail] returning lastDetail after ${MAX_ATTEMPTS} attempts, hasUpdates=${Array.isArray(lastDetail?.Updates) && lastDetail.Updates.length > 0}`);
  return lastDetail;
}

function unwrapLawsuitResponse(data: Record<string, unknown>): Record<string, unknown> {
  // Handle wrapped responses: { data: {...} } or { item: {...} }
  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    const inner = data.data as Record<string, unknown>;
    if (inner._id || inner.LawsuitId || inner.Number) {
      console.log("[unwrapLawsuitResponse] unwrapping from 'data' key");
      return inner;
    }
  }
  if (data.item && typeof data.item === "object" && !Array.isArray(data.item)) {
    const inner = data.item as Record<string, unknown>;
    if (inner._id || inner.LawsuitId || inner.Number) {
      console.log("[unwrapLawsuitResponse] unwrapping from 'item' key");
      return inner;
    }
  }
  return data;
}

async function enrichLawsuitMovements(
  token: string,
  detail: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const enriched = { ...detail };
  const initialUpdates = extractLawsuitUpdates(detail);
  const nextPageUrl = asString(detail.NextPageUrlMovements) || asString(detail.nextPageUrlMovements);

  if (!nextPageUrl) {
    if (initialUpdates.length > 0) {
      enriched.Updates = initialUpdates;
    }
    return enriched;
  }

  const collected = [...initialUpdates];
  let currentUrl: string | null = nextPageUrl;

  for (let page = 0; page < 10 && currentUrl; page += 1) {
    const pageResult: TryJsonResult<unknown> = await tryJson<unknown>(resolveAgriskUrl(currentUrl), token, 15000);
    if (!pageResult.ok || pageResult.data == null) {
      break;
    }

    const pageUpdates = extractLawsuitUpdates(pageResult.data);
    if (pageUpdates.length > 0) {
      collected.push(...pageUpdates);
    }

    if (typeof result.data === "object" && !Array.isArray(result.data)) {
      currentUrl =
        asString((result.data as Record<string, unknown>).NextPageUrlMovements) ||
        asString((result.data as Record<string, unknown>).nextPageUrlMovements) ||
        asString((result.data as Record<string, unknown>).nextPageUrl) ||
        null;
    } else {
      currentUrl = null;
    }
  }

  if (collected.length > 0) {
    enriched.Updates = collected;
  }

  return enriched;
}

async function fetchRestritivos(
  token: string,
  clientId: string,
  queryRefs: QueryRef[],
): Promise<Record<string, unknown> | null> {
  const ref = findQueryRef(queryRefs, ["credit-restrictive", "restritivo"]);
  if (!ref?.queryId) return null;

  const data = await pollForReadyData(
    () => tryJson(`${AGRISK_BASE}/queries/clients/${clientId}/credit-restrictive/${ref.queryId}`, token, 12000),
    isReadyResult,
  );

  return data as Record<string, unknown> | null;
}

async function fetchEndividamento(
  token: string,
  clientId: string,
  queryRefs: QueryRef[],
): Promise<Record<string, unknown> | null> {
  const ref = findQueryRef(queryRefs, ["scr", "endividamento"]);
  if (!ref?.queryId) return null;

  const data = await pollForReadyData(
    () => tryJson(`${AGRISK_BASE}/queries/clients/${clientId}/scr/${ref.queryId}`, token, 15000),
    isReadyResult,
  );

  return data as Record<string, unknown> | null;
}

async function fetchCpr(
  token: string,
  clientId: string,
  queryRefs: QueryRef[],
): Promise<Record<string, unknown> | null> {
  const ref = findQueryRef(queryRefs, ["cpr"]);
  if (!ref?.queryId) return null;

  const data = await pollForReadyData(
    () => tryJson(`${AGRISK_BASE}/queries/clients/${clientId}/cpr/${ref.queryId}`, token, 12000),
    isReadyResult,
  );

  if (!data || typeof data !== "object") return null;
  return await enrichCprDetails(token, clientId, data as Record<string, unknown>);
}

async function enrichCprDetails(
  token: string,
  clientId: string,
  cprData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const items = Array.isArray(cprData.items) ? (cprData.items as Record<string, unknown>[]) : [];

  const detailedItems = await Promise.all(
    items.map(async (item) => {
      const cprId = asString(item.cercPublicidadeCprsId);
      if (!cprId) return item;

      const detail = await tryJson(`${AGRISK_BASE}/queries/clients/${clientId}/cpr-details/${cprId}`, token, 12000);

      return detail.ok && detail.data
        ? { ...item, details: detail.data }
        : {
            ...item,
            detailsError: detail.error || "Nao foi possivel carregar o detalhe da CPR.",
          };
    }),
  );

  return { ...cprData, detailedItems };
}

async function fetchImoveisSimples(token: string, clientId: string): Promise<Record<string, unknown> | null> {
  const [rural, urban] = await Promise.all([
    tryJson(`${AGRISK_BASE}/assets/${clientId}/properties/rural?page=1`, token, 12000),
    tryJson(`${AGRISK_BASE}/assets/${clientId}/properties/urban/list`, token, 12000),
  ]);

  const ruralData =
    rural.ok && rural.data && typeof rural.data === "object" ? (rural.data as Record<string, unknown>) : null;
  const urbanData =
    urban.ok && urban.data && typeof urban.data === "object" ? (urban.data as Record<string, unknown>) : null;

  if (!ruralData && !urbanData) {
    return null;
  }

  const ruralItems = ruralData && Array.isArray(ruralData.items) ? (ruralData.items as Record<string, unknown>[]) : [];

  const ruralDetails = await Promise.all(
    ruralItems.map(async (item) => {
      const propertyId = asString(item.propertyId);
      if (!propertyId) return item;

      const detail = await tryJson(`${AGRISK_BASE}/assets/properties/rural/${propertyId}`, token, 12000);

      return detail.ok && detail.data ? { ...item, details: detail.data } : item;
    }),
  );

  return {
    rural: ruralData,
    urban: urbanData,
    ruralDetails,
  };
}

async function fetchImoveisCar(
  token: string,
  clientId: string,
  queryRefs: QueryRef[],
): Promise<Record<string, unknown> | null> {
  const ref = findQueryRef(queryRefs, ["car", "cadastro ambiental rural"]);
  if (!ref?.queryId) return null;

  const data = await pollForReadyData(
    () => tryJson(`${AGRISK_BASE}/v2/queries/clients/${clientId}/${ref.queryId}/cars?page=1`, token, 15000),
    isReadyResult,
  );

  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const items = Array.isArray(record.items) ? (record.items as Record<string, unknown>[]) : [];

  const details = await Promise.all(
    items.map(async (item) => {
      const carId = asString(item._id);
      if (!carId) return item;

      const detail = await tryJson(`${AGRISK_BASE}/v2/queries/clients/cars/${carId}`, token, 12000);

      return detail.ok && detail.data
        ? detail.data
        : { ...item, detailsError: detail.error || "Nao foi possivel carregar o detalhe do CAR." };
    }),
  );

  return {
    ...record,
    details,
  };
}

async function fetchPatrimonioVeicular(token: string, queryRefs: QueryRef[]): Promise<Record<string, unknown> | null> {
  const ref = findQueryRef(queryRefs, ["vehicle-assets", "veicular", "vehicle"]);
  if (!ref?.queryId) return null;

  const data = await pollForReadyData(
    () => tryJson(`${AGRISK_BASE}/v2/queries/vehicle-assets/${ref.queryId}`, token, 15000),
    isReadyResult,
  );

  return data as Record<string, unknown> | null;
}

async function fetchArmazens(
  token: string,
  clientId: string,
  queryRefs: QueryRef[],
): Promise<Record<string, unknown> | null> {
  const ref = findQueryRef(queryRefs, ["registered-warehouses", "armazem", "armazens", "warehouse", "conab", "silo"]);
  if (!ref?.queryId) {
    console.log(`[fetchArmazens] no matching queryRef found. Available: ${queryRefs.map(r => r.serviceKey).join(", ")}`);
    return null;
  }

  console.log(`[fetchArmazens] using ref serviceKey=${ref.serviceKey} queryId=${ref.queryId} status=${ref.status}`);

  // Try multiple possible endpoint paths
  const endpoints = [
    `/v2/queries/clients/${clientId}/registered-warehouses/${ref.queryId}`,
    `/queries/clients/${clientId}/registered-warehouses/${ref.queryId}`,
    `/queries/clients/${clientId}/armazens/${ref.queryId}`,
    `/v2/queries/clients/${clientId}/armazens/${ref.queryId}`,
  ];

  for (const path of endpoints) {
    const data = await pollForReadyData(
      () => tryJson(`${AGRISK_BASE}${path}`, token, 15000),
      isReadyResult,
    );
    if (data && typeof data === "object") {
      const text = JSON.stringify(data);
      if (text.length > 10 && text !== "{}" && text !== "[]") {
        console.log(`[fetchArmazens] success with path=${path}`);
        return data as Record<string, unknown>;
      }
    }
  }

  console.log(`[fetchArmazens] all endpoint paths failed`);
  return null;
}

function findQueryRef(queryRefs: QueryRef[], matchers: string[]): QueryRef | null {
  const normalizedMatchers = matchers.map(normalizeText);
  const ranked = queryRefs
    .map((ref) => {
      const haystack = normalizeText(ref.serviceKey);
      let score = 0;

      for (const matcher of normalizedMatchers) {
        if (haystack === matcher) score += 100;
        else if (haystack.includes(matcher)) score += 20 + matcher.length;
      }

      return { ref, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.ref || null;
}

async function pollForReadyData(
  fetcher: () => Promise<TryJsonResult>,
  predicate: (data: unknown) => boolean,
): Promise<unknown | null> {
  let lastData: unknown = null;

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const result = await fetcher();
    if (result.ok && result.data) {
      lastData = result.data;
      if (predicate(result.data)) {
        return result.data;
      }
    }

    if (attempt < POLL_ATTEMPTS - 1) {
      await sleep(POLL_DELAY_MS);
    }
  }

  return lastData;
}

function isReadyResult(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const record = data as Record<string, unknown>;
  const statusCandidates = [
    asString(record.requestStatus),
    asString(record.status),
    asString(record.queryStatus),
  ].filter(Boolean) as string[];

  if (statusCandidates.some(isPendingStatus)) {
    return false;
  }

  if (Array.isArray(record.items) && record.items.length === 0 && !record.completedAt) {
    return false;
  }

  return true;
}

function isPendingStatus(status?: string): boolean {
  if (!status) return false;
  const normalized = normalizeText(status);
  return /(pending|process|queue|running|requested|aguardando|andamento|fila)/.test(normalized);
}

function hasLawsuitTimeline(detail: Record<string, unknown> | null): boolean {
  if (!detail) return false;

  return (
    extractLawsuitUpdates(detail).length > 0 ||
    (Array.isArray(detail.Decisions) && detail.Decisions.length > 0) ||
    (Array.isArray(detail.Petitions) && detail.Petitions.length > 0)
  );
}

function extractLawsuitUpdates(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const directCandidates = [record.Updates, record.updates, record.Movements, record.movements, record.items];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    }
  }

  return [];
}

function resolveAgriskUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${AGRISK_BASE}${url.startsWith("/") ? url : `/${url}`}`;
}

async function tryJson<T = unknown>(url: string, token: string, timeoutMs = 8000): Promise<TryJsonResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    const text = await res.text();
    let data: T | null = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: text || `HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeTaxId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

function asConsultaType(value: unknown): ConsultaType | null {
  if (typeof value !== "string") return null;
  const allowed: ConsultaType[] = [
    "consulta_cliente",
    "restritivos",
    "endividamento",
    "cpr",
    "imoveis_simples",
    "imoveis_car",
    "patrimonio_veicular",
    "armazens",
  ];

  return allowed.includes(value as ConsultaType) ? (value as ConsultaType) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
