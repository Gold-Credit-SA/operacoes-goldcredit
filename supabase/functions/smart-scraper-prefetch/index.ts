// deno-lint-ignore-file no-explicit-any
// ============================================================================
// smart-scraper-prefetch
// Chamada por pg_cron diariamente (ex: 06:00 BRT, 09:00 UTC).
// Identifica títulos que serão cobrados nas próximas 24h pela régua e dispara
// pré-fetch via smart-scraper. Resultado: cache populado antes da janela de
// envio. Régua pega cache hit e nunca falha por scraping.
//
// Decisão arquitetural (ponto 1): essa é a perna do "pre-fetch" do A+C.
// ============================================================================

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

const PREFETCH_HOURS_AHEAD = 24;
const MAX_TITLES_PER_RUN = 500;          // proteção contra runaway
const RATE_LIMIT_PER_SEC = 1;            // 1 título por segundo (~30 / hora pelo worker concorrência 2)
const RATE_LIMIT_DELAY_MS = Math.ceil(1000 / RATE_LIMIT_PER_SEC);

// ----------------------------------------------------------------------------
// Cron auth: aceita Bearer com CRON_SECRET ou service_role.
// ----------------------------------------------------------------------------
function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return (cronSecret && token === cronSecret) || (serviceKey && token === serviceKey);
}

// ----------------------------------------------------------------------------
// Identifica títulos elegíveis para pre-fetch.
// Estratégia: títulos com vencimento entre hoje e hoje+N dias que ainda não
// têm cache válido OU cujo source_updated_at é mais recente que o cache.
//
// AJUSTAR: este SELECT depende da régua. A régua diz "X dias após vencimento
// dispara cobrança". Pra pre-fetch precisamos saber QUAIS títulos a régua vai
// pegar amanhã. Esta consulta é um placeholder razoável — substituir pela
// lógica real da sua régua.
// ----------------------------------------------------------------------------
async function listTitulosToPrefetch(supabase: any): Promise<Array<{ titulo_id: string; tipo: "boleto" | "nf" }>> {
  // TODO(régua): pegar dias_min/dias_max de cobranca_regua para calcular
  // exatamente quais títulos a régua vai disparar amanhã. Por enquanto
  // pre-fetch genérico de tudo que vence em até PREFETCH_HOURS_AHEAD.
  const inicio = new Date();
  const fim = new Date(Date.now() + PREFETCH_HOURS_AHEAD * 60 * 60 * 1000);

  // Pra esse MVP: pegamos da view smartsecurities_titulos_em_aberto via RPC ou
  // direct postgres. Pra não duplicar lookupTitulo, usamos external-db.
  const { data, error } = await supabase.functions.invoke("external-db", {
    body: {
      action: "titulos-aberto",
      filters: {
        dataInicio: inicio.toISOString().slice(0, 10),
        dataFim: fim.toISOString().slice(0, 10),
      },
    },
  });

  if (error || !data?.success) {
    console.error("[prefetch] external-db falhou:", error ?? data);
    return [];
  }

  const titulos = (data.data ?? []) as any[];
  const limited = titulos.slice(0, MAX_TITLES_PER_RUN);

  // Cada título precisa de boleto (NF é opcional, geralmente já existe).
  const jobs: Array<{ titulo_id: string; tipo: "boleto" | "nf" }> = [];
  for (const t of limited) {
    const id = t.id_titulo ?? t.titulo_id;
    if (!id) continue;
    jobs.push({ titulo_id: String(id), tipo: "boleto" });
    // NF pré-fetcheia só se ainda não existir cache (TTL 30d cobre).
    jobs.push({ titulo_id: String(id), tipo: "nf" });
  }

  // Marca jobs (idempotente pelo UNIQUE) para auditoria.
  const scheduledFor = new Date();
  scheduledFor.setUTCHours(0, 0, 0, 0);
  const rows = jobs.map((j) => ({
    scheduled_for: scheduledFor.toISOString(),
    titulo_id: j.titulo_id,
    tipo: j.tipo,
    status: "queued",
  }));
  if (rows.length > 0) {
    await supabase
      .from("smart_scraper_prefetch_jobs")
      .upsert(rows, { onConflict: "scheduled_for,titulo_id,tipo", ignoreDuplicates: true })
      .then(() => undefined, (err: any) => console.warn("[prefetch] job upsert warn:", err));
  }

  return _dedupeJobs(jobs);
}

function _dedupeJobs(jobs: Array<{ titulo_id: string; tipo: "boleto" | "nf" }>) {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const k = `${j.tipo}:${j.titulo_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ----------------------------------------------------------------------------
// Invoca smart-scraper para cada título sequencialmente respeitando rate limit.
// ----------------------------------------------------------------------------
async function runPrefetch(jobs: Array<{ titulo_id: string; tipo: "boleto" | "nf" }>) {
  const supabase = getAdminClient();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let ok = 0, cache = 0, err = 0;

  for (const job of jobs) {
    const startedAt = new Date().toISOString();

    // Marca como processing.
    await supabase
      .from("smart_scraper_prefetch_jobs")
      .update({ status: "processing", started_at: startedAt, attempts: 1 })
      .eq("titulo_id", job.titulo_id)
      .eq("tipo", job.tipo)
      .then(() => undefined, () => undefined);

    const t0 = Date.now();
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/smart-scraper`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ titulo_id: job.titulo_id, tipo: job.tipo }),
      });
      const json = await res.json().catch(() => ({}));

      const durationMs = Date.now() - t0;
      let status: "done" | "failed" | "skipped_cache_hit" = "done";
      let errCode: string | null = null;
      let errMsg:  string | null = null;

      if (!res.ok || !json?.success) {
        status = "failed";
        errCode = json?.error_code ?? `HTTP_${res.status}`;
        errMsg  = json?.message ?? `HTTP ${res.status}`;
        err++;
      } else if (json.from_cache) {
        status = "skipped_cache_hit";
        cache++;
      } else {
        ok++;
      }

      await supabase
        .from("smart_scraper_prefetch_jobs")
        .update({
          status,
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_code: errCode,
          error_message: errMsg,
        })
        .eq("titulo_id", job.titulo_id)
        .eq("tipo", job.tipo)
        .then(() => undefined, () => undefined);
    } catch (e) {
      err++;
      await supabase
        .from("smart_scraper_prefetch_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
          error_code: "INTERNAL_ERROR",
          error_message: e instanceof Error ? e.message : String(e),
        })
        .eq("titulo_id", job.titulo_id)
        .eq("tipo", job.tipo)
        .then(() => undefined, () => undefined);
    }

    // Rate limit
    if (RATE_LIMIT_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
  }

  return { ok, cache, err, total: jobs.length };
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isAuthorized(req)) {
    return jsonResponse({ success: false, error_code: "UNAUTHORIZED", message: "Cron secret inválido" }, 401);
  }

  const startedAt = Date.now();
  const supabase = getAdminClient();

  try {
    const jobs = await listTitulosToPrefetch(supabase);
    if (jobs.length === 0) {
      return jsonResponse({ success: true, message: "Nenhum título elegível", stats: { ok: 0, cache: 0, err: 0, total: 0 } });
    }

    const stats = await runPrefetch(jobs);

    return jsonResponse({
      success: true,
      stats,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error_code: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
