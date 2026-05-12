import { getAdminClient } from './supabase-admin.ts';

export type LogStatus =
  | 'success'
  | 'user_error'
  | 'provider_error'
  | 'network_error'
  | 'cache_hit'
  | 'dedup_hit';

export interface IntegrationLogInput {
  traceId?: string | null;
  provider: string;
  action: string;
  docId?: string | null;
  userId?: string | null;
  status: LogStatus;
  httpStatus?: number | null;
  latencyMs?: number | null;
  costCents?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestHash?: string | null;
  requestExcerpt?: unknown;
  responseExcerpt?: unknown;
  consultaHistoryId?: string | null;
}

// Trunca JSONB para evitar gravar payloads enormes. SCR completo pode passar
// de 200KB; truncar em 64KB cobre o suficiente para diagnóstico sem inflar a tabela.
const MAX_EXCERPT_BYTES = 64 * 1024;

function truncateExcerpt(value: unknown): unknown {
  if (value == null) return null;
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (str.length <= MAX_EXCERPT_BYTES) {
      return typeof value === 'string' ? { raw: str } : value;
    }
    return {
      _truncated: true,
      _original_size: str.length,
      preview: str.substring(0, MAX_EXCERPT_BYTES),
    };
  } catch {
    return { _stringify_failed: true };
  }
}

function redactSecrets(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const cloned: Record<string, unknown> = Array.isArray(obj)
    ? ([...obj] as unknown as Record<string, unknown>)
    : { ...(obj as Record<string, unknown>) };
  const SENSITIVE = ['client_secret', 'clientSecret', 'password', 'jwt', 'access_token', 'accessToken', 'token', 'authorization'];
  for (const key of Object.keys(cloned)) {
    if (SENSITIVE.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      cloned[key] = '***REDACTED***';
    } else if (typeof cloned[key] === 'object' && cloned[key] !== null) {
      cloned[key] = redactSecrets(cloned[key]);
    }
  }
  return cloned;
}

export async function writeIntegrationLog(input: IntegrationLogInput): Promise<void> {
  try {
    const client = getAdminClient();
    await client.from('integration_logs').insert({
      trace_id: input.traceId ?? null,
      provider: input.provider,
      action: input.action,
      doc_id: input.docId ?? null,
      user_id: input.userId ?? null,
      status: input.status,
      http_status: input.httpStatus ?? null,
      latency_ms: input.latencyMs ?? null,
      cost_cents: input.costCents ?? null,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      request_hash: input.requestHash ?? null,
      request_excerpt: truncateExcerpt(redactSecrets(input.requestExcerpt)),
      response_excerpt: truncateExcerpt(input.responseExcerpt),
      consulta_history_id: input.consultaHistoryId ?? null,
    });
  } catch (err) {
    // Falha de log nunca deve quebrar a chamada principal.
    console.error('[logger] failed to write integration_log:', err);
  }
}

export function newTraceId(): string {
  return crypto.randomUUID();
}
