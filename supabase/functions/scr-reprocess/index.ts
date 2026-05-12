// Reprocessa uma resposta BACEN previamente salva, sem chamar a API
// HBI de novo. Útil quando o conversor BACEN→lsDtb é corrigido —
// permite "consertar" consultas antigas sem novo custo financeiro.
//
// Entrada: { job_id } OU { hbi_uuid_query } OU { integration_log_id }
// Saída:  { success, data, source: 'reprocessed' }
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAdminClient, resolveUserId } from '../_shared/supabase-admin.ts';
import { writeIntegrationLog, newTraceId } from '../_shared/logger.ts';
import { convertBacenToLsDtb } from '../_shared/formatters/scr-bacen-to-lsdtb.ts';

const PROVIDER = 'hbi-scr';

interface RequestBody {
  job_id?: string;
  hbi_uuid_query?: string;
  integration_log_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    return await handle(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[scr-reprocess] uncaught:', err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const traceId = newTraceId();
  const userId = await resolveUserId(req);
  if (!userId) {
    return jsonResponse({ error: 'Autenticação necessária.' }, 401);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'Body inválido. Esperado JSON.' }, 400);
  }

  const supabase = getAdminClient();
  let rawResponse: unknown = null;
  let docId: string | null = null;
  let sourceJobId: string | null = null;

  // 1) Tenta carregar de scr_query_jobs por id ou por hbi_uuid_query.
  if (body.job_id || body.hbi_uuid_query) {
    let query = supabase
      .from('scr_query_jobs')
      .select('id, doc_id, raw_response')
      .limit(1);
    query = body.job_id ? query.eq('id', body.job_id) : query.eq('hbi_uuid_query', body.hbi_uuid_query!);
    const { data: rows, error } = await query;
    if (error) return jsonResponse({ error: `Falha ao buscar job: ${error.message}` }, 500);
    const row = rows?.[0];
    if (row?.raw_response) {
      rawResponse = row.raw_response;
      docId = row.doc_id;
      sourceJobId = row.id;
    }
  }

  // 2) Fallback: tenta integration_logs (action=get_bacen guarda a resposta BACEN).
  if (!rawResponse && body.integration_log_id) {
    const { data: log, error } = await supabase
      .from('integration_logs')
      .select('doc_id, response_excerpt')
      .eq('id', body.integration_log_id)
      .eq('action', 'get_bacen')
      .maybeSingle();
    if (error) return jsonResponse({ error: `Falha ao buscar log: ${error.message}` }, 500);
    if (log?.response_excerpt) {
      rawResponse = log.response_excerpt;
      docId = log.doc_id;
    }
  }

  if (!rawResponse) {
    return jsonResponse({ error: 'Nenhuma resposta BACEN encontrada para reprocessar.' }, 404);
  }

  const converted = convertBacenToLsDtb(rawResponse, docId ?? undefined);

  await writeIntegrationLog({
    traceId, provider: PROVIDER, action: 'reprocess', docId, userId,
    status: converted && converted.lsDtb?.length > 0 ? 'success' : 'provider_error',
    errorMessage: converted ? null : 'Conversão produziu resultado vazio.',
    requestExcerpt: { job_id: sourceJobId, hbi_uuid_query: body.hbi_uuid_query, integration_log_id: body.integration_log_id },
    responseExcerpt: { lsOpCount: converted?.lsDtb?.[0]?.lsOp?.length ?? 0 },
  });

  // Atualiza parsed_response no job se houver
  if (sourceJobId && converted) {
    await supabase.from('scr_query_jobs').update({ parsed_response: converted }).eq('id', sourceJobId);
  }

  return jsonResponse({
    success: !!converted && (converted.lsDtb?.length ?? 0) > 0,
    source: 'reprocessed',
    trace_id: traceId,
    data: converted,
    parser_warning: !converted || !converted.lsDtb?.length
      ? 'Conversão BACEN→lsDtb não produziu dados. Inspecione raw_response no scr_query_jobs.'
      : undefined,
  });
}
