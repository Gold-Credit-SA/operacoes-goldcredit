import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGRISK_BASE = "https://api.agrisk.digital";
const POLL_DELAY_MS = 2500;
const POLL_ATTEMPTS = 8;

type ConsultaType =
  | "consulta_cliente"
  | "restritivos"
  | "endividamento"
  | "cpr"
  | "imoveis_simples"
  | "imoveis_car"
  | "patrimonio_veicular";

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
      return json({ data: products });
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
    console.error("[agrisk-query] error:", error);
    return json({
      error: error instanceof Error ? error.message : "Erro interno ao consultar AgRisk.",
    });
  }
});

async function handleFileProxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filePath = url.searchParams.get("file");

  if (!filePath) {
    return json({ error: "Missing file parameter" }, 400);
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

    return json({ error: "Arquivo nao encontrado" }, 404);
  } catch (error) {
    console.error("[agrisk-query] file proxy error:", error);
    return json({ error: "Erro ao buscar arquivo" }, 500);
  }
}

async function handleRegisterClient(body: Record<string, unknown>): Promise<Response> {
  const taxId = sanitizeTaxId(body?.taxId);
  if (!taxId) {
    return json({ error: "taxId e obrigatorio." }, 400);
  }

  const token = await agriskLogin();
  const clientId = await getOrCreateClient(token, taxId);

  const [clientDataResult, contactsResult] = await Promise.all([
    tryJson(`${AGRISK_BASE}/clients/client/${clientId}`, token, 6000),
    tryJson(`${AGRISK_BASE}/v2/queries/clients/${clientId}/contacts`, token, 6000),
  ]);

  return json({
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
    return json({ error: "clientId e obrigatorio." }, 400);
  }

  const token = await agriskLogin();
  const queryRefs = await waitForQueryRefs(token, clientId);
  const details = await fetchConsultaClienteDetails(token, clientId, queryRefs, queryId);

  return json({ data: details });
}

async function handleFetchLawsuitDetail(body: Record<string, unknown>): Promise<Response> {
  const clientId = asString(body?.clientId);
  const lawsuitId = asString(body?.lawsuitId);

  if (!clientId || !lawsuitId) {
    return json({
      data: null,
      error: "clientId e lawsuitId sao obrigatorios.",
    });
  }

  const token = await agriskLogin();
  const detail = await fetchLawsuitDetail(token, clientId, lawsuitId);

  if (!detail) {
    return json({
      data: null,
      error: "Nao foi possivel carregar o detalhe do processo.",
    });
  }

  return json({ data: detail });
}

async function handleConsulta(body: Record<string, unknown>): Promise<Response> {
  const taxId = sanitizeTaxId(body?.taxId);
  const consultaType = asConsultaType(body?.consultaType);

  if (!taxId || !consultaType) {
    return json({ error: "taxId e consultaType sao obrigatorios." }, 400);
  }

  const token = await agriskLogin();
  const clientId = await getOrCreateClient(token, taxId);
  const products = await listProducts(token);
  const product = findBestProduct(products, PRODUCT_HINTS[consultaType]);

  if (!product) {
    return json({
      error: `Nenhum produto AgRisk compativel encontrado para '${consultaType}'.`,
    });
  }

  const productId = product._id || product.id;
  if (!productId) {
    return json({
      error: `Produto AgRisk sem identificador para '${consultaType}'.`,
    });
  }

  const queryRequest = await requestQuery(token, clientId, [productId]);
  const initialRefs = extractQueryRefs(queryRequest);
  const queryRefs = await waitForQueryRefs(token, clientId, initialRefs);

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
  }

  if (!resultData) {
    return json({
      error: "Consulta enviada, mas nao foi possivel obter os resultados detalhados.",
    });
  }

  return json({
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
      ...(consultaType === "consulta_cliente" ? resultData : { details: resultData }),
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
  const existing = await findClientByTaxId(token, taxId);
  if (existing) {
    return existing;
  }

  const res = await fetch(`${AGRISK_BASE}/clients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ taxId }),
  });

  const text = await res.text();
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

  const duplicateId =
    (data && (asString(data.clientId) || asString(data.id) || asString(data._id))) || extractClientIdFromText(text);
  if (duplicateId) {
    return duplicateId;
  }

  throw new Error("Nao foi possivel cadastrar ou localizar o cliente informado no AgRisk.");
}

async function findClientByTaxId(token: string, taxId: string): Promise<string | null> {
  let page = 1;
  let nextPage = true;

  while (nextPage && page <= 100) {
    const result = await tryJson<{ items?: Record<string, unknown>[]; nextPage?: boolean }>(
      `${AGRISK_BASE}/v2/clients?filter=all&page=${page}`,
      token,
      8000,
    );

    if (!result.ok || !result.data) {
      break;
    }

    const items = Array.isArray(result.data.items) ? result.data.items : [];
    const found = items.find((client) => sanitizeTaxId(client.taxId) === taxId);
    if (found) {
      return asString(found._id) || asString(found.id);
    }

    nextPage = Boolean(result.data.nextPage);
    page += 1;
  }

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

async function waitForQueryRefs(token: string, clientId: string, initialRefs: QueryRef[] = []): Promise<QueryRef[]> {
  const merged = new Map<string, QueryRef>();
  for (const ref of initialRefs) {
    merged.set(ref.serviceKey, ref);
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const result = await tryJson<Record<string, unknown>>(`${AGRISK_BASE}/queries/clients/${clientId}`, token, 8000);

    if (result.ok && result.data) {
      const refs = extractQueryRefs(result.data);
      for (const ref of refs) {
        merged.set(ref.serviceKey, ref);
      }

      const hasRefs = merged.size > 0;
      const hasPending = Array.from(merged.values()).some((ref) => isPendingStatus(ref.status));

      if (hasRefs && !hasPending) {
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
  const result = await tryJson<Record<string, unknown>>(
    `${AGRISK_BASE}/queries/clients/${clientId}/lawsuits/${lawsuitId}`,
    token,
    15000,
  );

  if (!result.ok || !result.data || typeof result.data !== "object") {
    return null;
  }

  return result.data;
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
  return /(pending|process|queue|running|requested|aguardando|andamento)/.test(normalized);
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
