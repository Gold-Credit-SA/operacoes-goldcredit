// Edge function hbi-scr — orquestra a consulta SCR via API HBI.
//
// Fluxo:
//   1. Valida documento (CPF/CNPJ); falha aqui não custa nada.
//   2. Verifica dedupe (mesma consulta nos últimos 30s = retorna pendente).
//   3. Verifica cache (mesma consulta em janela TTL = retorna do cache).
//   4. Autentica na HBI.
//   5. Resolve uuidTypeScr (preferindo /form/type/scr; cai para env como fallback).
//   6. Resolve baseDateInitial (preferindo /company/scr/scrDataBase; cai para mês passado).
//   7. POST /query/scr/v2/new/{doc} — única chamada PAGA.
//   8. Aguarda status Concluído via /query/list/v2.
//   9. Busca formato Bacen via /query/bacen/{uuidQuery}.
//   10. Converte BACEN → lsDtb e retorna.
//
// Toda etapa grava em integration_logs (com `trace_id` correlacionando
// as chamadas), e o uuidQuery + resposta crua ficam em scr_query_jobs
// para reprocessamento sem nova chamada paga.
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAdminClient, resolveUserId } from '../_shared/supabase-admin.ts';
import { classifyDoc, isValidBaseDate, monthOffsetISO } from '../_shared/validators.ts';
import { hashRequest } from '../_shared/idempotency.ts';
import { cacheGet, cacheSet } from '../_shared/cache.ts';
import { writeIntegrationLog, newTraceId } from '../_shared/logger.ts';
import {
  hbiAuthenticate,
  hbiListScrTypes,
  hbiSuggestedBaseDate,
  hbiNewScrQuery,
  hbiWaitForCompletion,
  hbiGetBacenQuery,
  ScrConsultaType,
} from '../_shared/hbi-client.ts';
import { convertBacenToLsDtb } from '../_shared/formatters/scr-bacen-to-lsdtb.ts';

const PROVIDER = 'hbi-scr';
const CACHE_TTL_SECONDS = 60 * 60 * 6;      // 6h — SCR não muda dentro do mesmo dia
const DEDUP_WINDOW_SECONDS = 30;            // 30s — proteger contra cliques rápidos

interface RequestBody {
  cnpj?: string;
  document?: string;
  consultaType?: ScrConsultaType;
  baseDate?: string;
  baseDateFinal?: string;
  forceRefresh?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    return await handle(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[hbi-scr] uncaught:', err);
    return jsonResponse({ error: message }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const traceId = newTraceId();
  const userId = await resolveUserId(req);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'Body inválido. Esperado JSON.' }, 400);
  }

  const docInput = body.document || body.cnpj || '';
  const consultaType = (body.consultaType || 'AVULSA') as ScrConsultaType;

  // 1) Validação de documento — falha aqui é grátis.
  const doc = classifyDoc(docInput);
  if (!doc) {
    await writeIntegrationLog({
      traceId, provider: PROVIDER, action: 'validate', userId, status: 'user_error',
      errorCode: 'INVALID_DOC', errorMessage: 'Documento inválido',
      requestExcerpt: { docInput },
    });
    return jsonResponse({ error: 'Documento inválido. Informe CPF (11 dígitos) ou CNPJ (14 dígitos).' }, 400);
  }

  // 2) Validação de baseDate (se fornecida).
  if (body.baseDate && !isValidBaseDate(body.baseDate)) {
    return jsonResponse({ error: 'baseDate inválida. Formato esperado YYYY-MM e não pode ser futura.' }, 400);
  }
  if (body.baseDateFinal && !isValidBaseDate(body.baseDateFinal)) {
    return jsonResponse({ error: 'baseDateFinal inválida. Formato esperado YYYY-MM e não pode ser futura.' }, 400);
  }
  if (consultaType === 'COMPARATIVO' && !body.baseDateFinal) {
    return jsonResponse({ error: 'COMPARATIVO requer baseDateFinal.' }, 400);
  }

  // 3) Idempotência + cache.
  const reqHash = await hashRequest([PROVIDER, 'query', doc.clean, consultaType, body.baseDate ?? '', body.baseDateFinal ?? '']);
  const supabase = getAdminClient();

  if (!body.forceRefresh) {
    // 3a) Cache hit? (TTL controla quando vale "matar" a consulta paga.)
    const cached = await cacheGet<unknown>(reqHash);
    if (cached.hit) {
      await writeIntegrationLog({
        traceId, provider: PROVIDER, action: 'cache_lookup', docId: doc.clean, userId,
        status: 'cache_hit', requestHash: reqHash,
        responseExcerpt: { ageSeconds: cached.ageSeconds },
      });
      return jsonResponse({ success: true, source: 'cache', age_seconds: cached.ageSeconds, data: cached.payload });
    }

    // 3b) Job em vôo? Evita 2º clique disparar 2ª chamada paga.
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000).toISOString();
    const { data: inflight } = await supabase
      .from('scr_query_jobs')
      .select('id, status, hbi_uuid_query, parsed_response')
      .eq('doc_id', doc.clean)
      .eq('consulta_type', consultaType)
      .eq('base_date_initial', body.baseDate || '')
      .gte('created_at', dedupCutoff)
      .in('status', ['pending', 'dispatched', 'polling', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (inflight && inflight.length > 0) {
      const row = inflight[0];
      await writeIntegrationLog({
        traceId, provider: PROVIDER, action: 'dedup', docId: doc.clean, userId,
        status: 'dedup_hit', requestHash: reqHash,
        responseExcerpt: { job_id: row.id, status: row.status },
      });
      return jsonResponse({
        success: row.status === 'completed',
        source: 'dedup',
        message: row.status === 'completed'
          ? 'Mesma consulta concluída há instantes — retornando resultado.'
          : `Consulta idêntica já em andamento (status=${row.status}). Aguarde alguns instantes.`,
        job_id: row.id,
        hbi_uuid_query: row.hbi_uuid_query,
        data: row.parsed_response,
      });
    }
  }

  // 5) Autentica
  const auth = await hbiAuthenticate();
  await writeIntegrationLog({
    traceId, provider: PROVIDER, action: 'authenticate', docId: doc.clean, userId,
    status: auth.ok ? 'success' : (auth.error?.class ?? 'provider_error'),
    httpStatus: auth.meta.httpStatus, latencyMs: auth.meta.latencyMs,
    errorCode: auth.error?.code, errorMessage: auth.error?.message,
  });
  if (!auth.ok || !auth.data) {
    return jsonResponse({ error: auth.error?.userMessage || 'Falha na autenticação HBI.' }, 502);
  }
  const jwt = auth.data;

  // 6) Resolve uuidTypeScr — preferir endpoint dinâmico; fallback env; fallback hardcoded.
  let uuidTypeScr = Deno.env.get(`HBI_UUID_TYPE_SCR_${consultaType}`) || '';
  if (!uuidTypeScr) {
    const types = await hbiListScrTypes(jwt);
    await writeIntegrationLog({
      traceId, provider: PROVIDER, action: 'list_types', docId: doc.clean, userId,
      status: types.ok ? 'success' : (types.error?.class ?? 'provider_error'),
      httpStatus: types.meta.httpStatus, latencyMs: types.meta.latencyMs,
      errorCode: types.error?.code, errorMessage: types.error?.message,
    });
    if (types.ok && types.data) {
      uuidTypeScr = types.data.find(t => t.type === consultaType)?.uuidTypeScr ?? '';
    }
  }
  if (!uuidTypeScr) {
    return jsonResponse({ error: `uuidTypeScr para ${consultaType} indisponível. Verifique HBI_UUID_TYPE_SCR_${consultaType}.` }, 502);
  }

  // 7) Resolve baseDateInitial — usar /company/scr/scrDataBase se cliente não passou
  let baseDateInitial = body.baseDate || '';
  if (!baseDateInitial) {
    const suggested = await hbiSuggestedBaseDate(jwt);
    await writeIntegrationLog({
      traceId, provider: PROVIDER, action: 'suggest_base_date', docId: doc.clean, userId,
      status: suggested.ok ? 'success' : (suggested.error?.class ?? 'provider_error'),
      httpStatus: suggested.meta.httpStatus, latencyMs: suggested.meta.latencyMs,
      errorCode: suggested.error?.code, errorMessage: suggested.error?.message,
    });
    baseDateInitial = suggested.ok && suggested.data ? suggested.data : monthOffsetISO(1);
  }

  // 8) Persiste o job ANTES da chamada paga — assim, se algo der errado no caminho,
  // sabemos exatamente em que estado parou e podemos retomar/auditar.
  const { data: jobRow, error: jobErr } = await supabase
    .from('scr_query_jobs')
    .insert({
      user_id: userId,
      doc_id: doc.clean,
      consulta_type: consultaType,
      base_date_initial: baseDateInitial,
      base_date_final: body.baseDateFinal ?? null,
      uuid_type_scr: uuidTypeScr,
      status: 'pending',
      trace_id: traceId,
    })
    .select('id')
    .single();
  if (jobErr || !jobRow) {
    console.error('[hbi-scr] failed to persist scr_query_jobs:', jobErr);
  }
  const jobId = jobRow?.id;

  // 9) Dispara consulta (chamada paga).
  const newQuery = await hbiNewScrQuery({
    jwt,
    documentId: doc.clean,
    uuidTypeScr,
    baseDateInitial,
    baseDateFinal: body.baseDateFinal,
  });
  await writeIntegrationLog({
    traceId, provider: PROVIDER, action: 'new_query', docId: doc.clean, userId,
    status: newQuery.ok ? 'success' : (newQuery.error?.class ?? 'provider_error'),
    httpStatus: newQuery.meta.httpStatus, latencyMs: newQuery.meta.latencyMs,
    errorCode: newQuery.error?.code, errorMessage: newQuery.error?.message,
    requestHash: reqHash,
    requestExcerpt: newQuery.meta.request,
    responseExcerpt: newQuery.meta.response,
  });

  if (!newQuery.ok || !newQuery.data) {
    if (jobId) {
      await supabase.from('scr_query_jobs').update({
        status: 'failed',
        error_code: newQuery.error?.code,
        error_message: newQuery.error?.message,
      }).eq('id', jobId);
    }
    const status = newQuery.error?.class === 'user_error' ? 400 : 502;
    return jsonResponse({ error: newQuery.error?.userMessage || 'Falha ao consultar SCR.' }, status);
  }

  const uuidQuery = newQuery.data.uuidQuery;
  if (jobId) {
    await supabase.from('scr_query_jobs').update({
      status: 'dispatched',
      hbi_uuid_query: uuidQuery,
    }).eq('id', jobId);
  }

  // 10) Aguarda Concluído.
  const finished = uuidQuery
    ? await hbiWaitForCompletion(jwt, doc.clean, { preferUuidQuery: uuidQuery, maxAttempts: 12, intervalMs: 2_500 })
    : await hbiWaitForCompletion(jwt, doc.clean, { maxAttempts: 12, intervalMs: 2_500 });
  await writeIntegrationLog({
    traceId, provider: PROVIDER, action: 'wait_completion', docId: doc.clean, userId,
    status: finished.ok ? 'success' : (finished.error?.class ?? 'provider_error'),
    httpStatus: finished.meta.httpStatus, latencyMs: finished.meta.latencyMs,
    errorCode: finished.error?.code, errorMessage: finished.error?.message,
    responseExcerpt: finished.meta.response,
  });
  if (!finished.ok || !finished.data) {
    if (jobId) {
      await supabase.from('scr_query_jobs').update({
        status: finished.error?.code === 'TIMEOUT' ? 'polling' : 'failed',
        error_code: finished.error?.code,
        error_message: finished.error?.message,
        last_polled_at: new Date().toISOString(),
      }).eq('id', jobId);
    }
    return jsonResponse({
      error: finished.error?.userMessage || 'Falha aguardando conclusão da consulta SCR.',
      job_id: jobId,
      hbi_uuid_query: uuidQuery,
    }, 504);
  }

  const finalUuid = finished.data.id || uuidQuery;
  if (!finalUuid) {
    return jsonResponse({ error: 'Não foi possível identificar o uuidQuery da consulta.' }, 502);
  }

  // 11) Busca BACEN cru.
  const bacen = await hbiGetBacenQuery(jwt, finalUuid);
  await writeIntegrationLog({
    traceId, provider: PROVIDER, action: 'get_bacen', docId: doc.clean, userId,
    status: bacen.ok ? 'success' : (bacen.error?.class ?? 'provider_error'),
    httpStatus: bacen.meta.httpStatus, latencyMs: bacen.meta.latencyMs,
    errorCode: bacen.error?.code, errorMessage: bacen.error?.message,
    responseExcerpt: bacen.ok ? bacen.data : bacen.meta.response,
  });
  if (!bacen.ok || !bacen.data) {
    if (jobId) {
      await supabase.from('scr_query_jobs').update({
        status: 'failed',
        error_code: bacen.error?.code,
        error_message: bacen.error?.message,
      }).eq('id', jobId);
    }
    return jsonResponse({
      error: bacen.error?.userMessage || 'Falha ao buscar resposta Bacen do SCR.',
      hbi_uuid_query: finalUuid,
      job_id: jobId,
    }, 502);
  }

  // 12) Converte BACEN → lsDtb.
  const converted = convertBacenToLsDtb(bacen.data);
  // Mescla nome retornado pela listagem (raramente vem no BACEN).
  if (converted && !converted.name && finished.data.name) {
    converted.name = finished.data.name;
  }

  // 13) Persiste resultado no job e no cache.
  if (jobId) {
    await supabase.from('scr_query_jobs').update({
      status: 'completed',
      raw_response: bacen.data,
      parsed_response: converted,
    }).eq('id', jobId);
  }

  // Só cacheia se a conversão funcionou — não queremos servir lixo do cache.
  if (converted && converted.lsDtb?.length > 0) {
    await cacheSet({
      hash: reqHash,
      provider: PROVIDER,
      action: 'query',
      docId: doc.clean,
      payload: converted,
      ttlSeconds: CACHE_TTL_SECONDS,
    });
  }

  return jsonResponse({
    success: true,
    source: 'live',
    trace_id: traceId,
    hbi_uuid_query: finalUuid,
    job_id: jobId,
    data: converted ?? bacen.data,
    parser_warning: !converted ? 'Conversão BACEN→lsDtb não produziu dados; retornando resposta crua para diagnóstico.' : undefined,
  });
}
