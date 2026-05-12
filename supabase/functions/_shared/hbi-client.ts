// Cliente HBI compartilhado: autenticação + endpoints SCR.
// Cada método retorna { result, log } onde `log` traz metadados
// (latency, status, error) para que o caller registre em
// integration_logs sem reimplementar.

import { fetchWithRetry } from './http-client.ts';
import { classifyHbiError, classifyNetworkError, ClassifiedError } from './error-classifier.ts';

const HBI_USER_ID = 'be3cf5f4-cc5d-45c8-ab1b-b2ddffe635a4';

export type ScrConsultaType = 'AVULSA' | 'COMPARATIVO' | 'DETALHADA';

export interface HbiCallMeta {
  latencyMs: number;
  httpStatus: number;
  attempts: number;
  url: string;
  request?: unknown;
  response?: unknown;
}

export interface HbiResult<T> {
  ok: boolean;
  data: T | null;
  error: ClassifiedError | null;
  meta: HbiCallMeta;
}

export interface ScrTypeInfo {
  uuidTypeScr: string;
  description: string;
  type: ScrConsultaType;
  months: string;
  baseDateInitial: string;
  baseDateFinal: string;
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Variável ${name} não configurada.`);
  return v;
}

function apiUrl(): string {
  return requireEnv('HBI_API_URL').replace(/\/+$/, '');
}

export async function hbiAuthenticate(): Promise<HbiResult<string>> {
  const url = `${apiUrl()}/authentication/login`;
  const body = {
    client_id: requireEnv('HBI_CLIENT_ID'),
    client_secret: requireEnv('HBI_CLIENT_SECRET'),
    grant_type: requireEnv('HBI_GRANT_TYPE'),
    scope: requireEnv('HBI_SCOPE'),
  };

  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', user: HBI_USER_ID },
      body: JSON.stringify(body),
      timeoutMs: 15_000,
      maxRetries: 1,
    });

    const meta: HbiCallMeta = { latencyMs: res.latencyMs, httpStatus: res.status, attempts: res.attempts, url, response: res.bodyJson };
    if (!res.ok) {
      return { ok: false, data: null, error: classifyHbiError(res.bodyJson, res.status), meta };
    }
    const payload = (res.bodyJson ?? {}) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const jwt = (data.jwt as string) || (payload.access_token as string) || (payload.token as string);
    if (!jwt) {
      return {
        ok: false,
        data: null,
        error: { class: 'provider_error', code: 'NO_JWT', message: 'Token não retornado pela API HBI.', retryable: false, userMessage: 'Autenticação HBI falhou: token ausente na resposta.' },
        meta,
      };
    }
    return { ok: true, data: jwt, error: null, meta };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: classifyNetworkError(err),
      meta: { latencyMs: 0, httpStatus: 0, attempts: 1, url },
    };
  }
}

// Lista os tipos de consulta SCR disponíveis na conta HBI.
// Retorna { AVULSA, COMPARATIVO, DETALHADA } com seus UUIDs atuais —
// usar valores hardcoded é frágil porque os UUIDs podem variar.
export async function hbiListScrTypes(jwt: string): Promise<HbiResult<ScrTypeInfo[]>> {
  const url = `${apiUrl()}/form/type/scr`;
  try {
    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}`, user: HBI_USER_ID },
      timeoutMs: 15_000,
      maxRetries: 1,
    });
    const meta: HbiCallMeta = { latencyMs: res.latencyMs, httpStatus: res.status, attempts: res.attempts, url, response: res.bodyJson };
    if (!res.ok) {
      return { ok: false, data: null, error: classifyHbiError(res.bodyJson, res.status), meta };
    }
    const payload = res.bodyJson as { data?: ScrTypeInfo[] };
    return { ok: true, data: payload?.data ?? [], error: null, meta };
  } catch (err) {
    return { ok: false, data: null, error: classifyNetworkError(err), meta: { latencyMs: 0, httpStatus: 0, attempts: 1, url } };
  }
}

// Sugere a data-base SCR mais recente válida.
export async function hbiSuggestedBaseDate(jwt: string): Promise<HbiResult<string>> {
  const url = `${apiUrl()}/company/scr/scrDataBase`;
  try {
    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}`, user: HBI_USER_ID },
      timeoutMs: 10_000,
      maxRetries: 1,
    });
    const meta: HbiCallMeta = { latencyMs: res.latencyMs, httpStatus: res.status, attempts: res.attempts, url, response: res.bodyJson };
    if (!res.ok) {
      return { ok: false, data: null, error: classifyHbiError(res.bodyJson, res.status), meta };
    }
    const payload = res.bodyJson as { data?: { scrSuggestDataBase?: string } };
    const dt = payload?.data?.scrSuggestDataBase;
    if (!dt) {
      return { ok: false, data: null, error: { class: 'provider_error', code: 'NO_DATE', message: 'scrSuggestDataBase ausente.', retryable: false, userMessage: 'API HBI não retornou data-base sugerida.' }, meta };
    }
    return { ok: true, data: dt, error: null, meta };
  } catch (err) {
    return { ok: false, data: null, error: classifyNetworkError(err), meta: { latencyMs: 0, httpStatus: 0, attempts: 1, url } };
  }
}

export interface ScrNewQueryInput {
  jwt: string;
  documentId: string;
  uuidTypeScr: string;
  baseDateInitial: string;
  baseDateFinal?: string;
}

export interface ScrNewQueryResult {
  uuidQuery: string | null;
  // Resposta crua (alguns ambientes retornam dado direto sem polling).
  rawResponse: unknown;
}

export async function hbiNewScrQuery(input: ScrNewQueryInput): Promise<HbiResult<ScrNewQueryResult>> {
  const url = `${apiUrl()}/query/scr/v2/new/${encodeURIComponent(input.documentId)}`;
  const body: Record<string, unknown> = {
    baseDateInitial: input.baseDateInitial,
    uuidTypeScr: input.uuidTypeScr,
  };
  if (input.baseDateFinal) body.baseDateFinal = input.baseDateFinal;

  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.jwt}`, 'Content-Type': 'application/json', user: HBI_USER_ID },
      body: JSON.stringify(body),
      timeoutMs: 30_000,
      maxRetries: 0, // NUNCA retry: consulta paga.
    });
    const meta: HbiCallMeta = { latencyMs: res.latencyMs, httpStatus: res.status, attempts: res.attempts, url, request: body, response: res.bodyJson };
    if (!res.ok) {
      return { ok: false, data: null, error: classifyHbiError(res.bodyJson, res.status), meta };
    }

    // Mesmo HTTP 200 pode esconder erro semântico (codigo 52, etc.).
    const semantic = classifyHbiError(res.bodyJson, res.status);
    if (semantic.code === '52') {
      return { ok: false, data: null, error: semantic, meta };
    }

    const payload = (res.bodyJson ?? {}) as Record<string, unknown>;
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const uuidQuery =
      (payload.uuidQuery as string) ||
      (data.uuidQuery as string) ||
      (data.id as string) ||
      null;

    return { ok: true, data: { uuidQuery, rawResponse: res.bodyJson }, error: null, meta };
  } catch (err) {
    return { ok: false, data: null, error: classifyNetworkError(err), meta: { latencyMs: 0, httpStatus: 0, attempts: 1, url } };
  }
}

export interface ScrListItem {
  id: string;
  documentId: string;
  name?: string;
  service: string;
  reference?: string;
  status: { title: string; color: string };
  createdDate?: string;
}

export async function hbiListScrQueries(jwt: string, doc: string): Promise<HbiResult<ScrListItem[]>> {
  const url = `${apiUrl()}/query/list/v2?service=SCR&q=${encodeURIComponent(doc)}`;
  try {
    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}`, user: HBI_USER_ID },
      timeoutMs: 15_000,
      maxRetries: 1,
    });
    const meta: HbiCallMeta = { latencyMs: res.latencyMs, httpStatus: res.status, attempts: res.attempts, url, response: res.bodyJson };
    if (!res.ok) {
      return { ok: false, data: null, error: classifyHbiError(res.bodyJson, res.status), meta };
    }
    const payload = res.bodyJson as { data?: ScrListItem[] };
    return { ok: true, data: payload?.data ?? [], error: null, meta };
  } catch (err) {
    return { ok: false, data: null, error: classifyNetworkError(err), meta: { latencyMs: 0, httpStatus: 0, attempts: 1, url } };
  }
}

// Busca o resultado formatado de uma consulta.
// type: 'SCR' (avulsa/detalhada) | 'COMP_SCR' (comparativo)
export async function hbiGetScrQuery(jwt: string, uuidQuery: string, type: 'SCR' | 'COMP_SCR' = 'SCR'): Promise<HbiResult<unknown>> {
  const url = `${apiUrl()}/query/get/${encodeURIComponent(uuidQuery)}/${encodeURIComponent(type)}`;
  try {
    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}`, user: HBI_USER_ID },
      timeoutMs: 30_000,
      maxRetries: 1,
    });
    const meta: HbiCallMeta = { latencyMs: res.latencyMs, httpStatus: res.status, attempts: res.attempts, url, response: res.bodyJson };
    if (!res.ok) {
      return { ok: false, data: null, error: classifyHbiError(res.bodyJson, res.status), meta };
    }
    return { ok: true, data: res.bodyJson, error: null, meta };
  } catch (err) {
    return { ok: false, data: null, error: classifyNetworkError(err), meta: { latencyMs: 0, httpStatus: 0, attempts: 1, url } };
  }
}

// Busca o resultado em formato Bacen cru (listaDeResumoDasOperacoes etc.).
export async function hbiGetBacenQuery(jwt: string, uuidQuery: string): Promise<HbiResult<unknown>> {
  const url = `${apiUrl()}/query/bacen/${encodeURIComponent(uuidQuery)}`;
  try {
    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}`, user: HBI_USER_ID },
      timeoutMs: 30_000,
      maxRetries: 1,
    });
    const meta: HbiCallMeta = { latencyMs: res.latencyMs, httpStatus: res.status, attempts: res.attempts, url, response: res.bodyJson };
    if (!res.ok) {
      return { ok: false, data: null, error: classifyHbiError(res.bodyJson, res.status), meta };
    }
    return { ok: true, data: res.bodyJson, error: null, meta };
  } catch (err) {
    return { ok: false, data: null, error: classifyNetworkError(err), meta: { latencyMs: 0, httpStatus: 0, attempts: 1, url } };
  }
}

// Espera o status "Concluído" para um documentId (polling na listagem).
// Retorna o ScrListItem encontrado. Não busca o dado em si — para isso
// usar hbiGetScrQuery ou hbiGetBacenQuery após obter o uuidQuery.
export async function hbiWaitForCompletion(
  jwt: string,
  doc: string,
  options: { maxAttempts?: number; intervalMs?: number; preferUuidQuery?: string } = {},
): Promise<HbiResult<ScrListItem>> {
  const maxAttempts = options.maxAttempts ?? 12;
  const intervalMs = options.intervalMs ?? 2_500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const list = await hbiListScrQueries(jwt, doc);
    if (!list.ok) {
      // Continua tentando enquanto for erro de rede
      if (list.error?.class === 'network_error' && attempt < maxAttempts) continue;
      return list as HbiResult<ScrListItem>;
    }
    // Prefere a entrada que matches o uuidQuery se passado, senão a primeira
    const items = list.data ?? [];
    const target = options.preferUuidQuery
      ? items.find(i => i.id === options.preferUuidQuery) ?? items[0]
      : items[0];
    if (target && target.status?.title === 'Concluído') {
      return { ok: true, data: target, error: null, meta: list.meta };
    }
    if (target && (target.status?.color === 'error' || target.status?.title === 'Falhou')) {
      return {
        ok: false,
        data: null,
        error: { class: 'provider_error', code: 'QUERY_FAILED', message: `Consulta marcada como ${target.status.title}.`, retryable: false, userMessage: 'A HBI marcou a consulta como falha. Refaça em alguns minutos.' },
        meta: list.meta,
      };
    }
  }
  return {
    ok: false,
    data: null,
    error: { class: 'network_error', code: 'TIMEOUT', message: 'Polling SCR esgotado.', retryable: true, userMessage: 'A consulta SCR demorou mais que o esperado. Verifique o histórico em alguns minutos.' },
    meta: { latencyMs: maxAttempts * intervalMs, httpStatus: 0, attempts: maxAttempts, url: 'polling' },
  };
}
