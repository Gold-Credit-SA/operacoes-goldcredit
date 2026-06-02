// deno-lint-ignore-file no-explicit-any
// ============================================================================
// smart-scraper-health
// Endpoint de observabilidade — chamado pela página /smart-scraper-status do
// app. Faz 2 coisas:
//
//   1. Pinga o /health do worker VPS (via SMART_SCRAPER_URL)
//   2. Agrega dados do cache (smart_anexos_cache) — total, recentes, por tipo
//
// Cache em memória de 15s pra não martelar o worker.
// ============================================================================

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, resolveUserId } from "../_shared/supabase-admin.ts";

interface WorkerHealth {
  ok: boolean;
  uptime_s?: number;
  queue?: { pending?: number; waiting?: number; inflight?: number; concurrency?: number };
  error?: string;
  latency_ms?: number;
}

interface CacheStats {
  total: number;
  por_tipo: Record<string, number>;
  ultimos: Array<{
    titulo_id: string;
    tipo: string;
    bytes: number;
    fetched_at: string;
    expires_at: string;
    hit_count: number;
  }>;
}

interface HealthPayload {
  checked_at: string;
  worker: WorkerHealth;
  cache: CacheStats | null;
  cache_error?: string;
}

let cached: { value: HealthPayload; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

async function pingWorker(): Promise<WorkerHealth> {
  const url = Deno.env.get("SMART_SCRAPER_URL");
  if (!url) {
    return { ok: false, error: "SMART_SCRAPER_URL não configurado" };
  }
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
      headers: { "Accept": "application/json" },
      signal: ctrl.signal,
    });
    const latency = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, latency_ms: latency };
    }
    const j = await res.json();
    return {
      ok: Boolean(j?.ok),
      uptime_s: j?.uptime_s,
      queue: j?.queue,
      latency_ms: latency,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: (err as any)?.name === "AbortError" ? "timeout (8s)" : msg,
      latency_ms: Date.now() - t0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getCacheStats(): Promise<CacheStats | { error: string }> {
  try {
    const supabase = getAdminClient();
    const { data: ultimos, error: e1 } = await supabase
      .from("smart_anexos_cache")
      .select("titulo_id, tipo, bytes, fetched_at, expires_at, hit_count")
      .order("fetched_at", { ascending: false })
      .limit(20);
    if (e1) return { error: e1.message };

    const total = ultimos?.length ?? 0;
    const por_tipo: Record<string, number> = {};
    (ultimos ?? []).forEach((r: any) => {
      por_tipo[r.tipo] = (por_tipo[r.tipo] ?? 0) + 1;
    });

    // Conta total geral (pode ser > 20)
    const { count } = await supabase
      .from("smart_anexos_cache")
      .select("*", { count: "exact", head: true });

    return {
      total: count ?? total,
      por_tipo,
      ultimos: ultimos ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth — só usuário logado pode ver status
  const userId = await resolveUserId(req);
  if (!userId) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  // Cache pra não martelar o worker
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse({ ...cached.value, from_cache: true });
  }

  const [worker, cacheResult] = await Promise.all([pingWorker(), getCacheStats()]);
  const cacheStats = "error" in cacheResult ? null : cacheResult;
  const cacheError = "error" in cacheResult ? cacheResult.error : undefined;

  const payload: HealthPayload = {
    checked_at: new Date().toISOString(),
    worker,
    cache: cacheStats,
    ...(cacheError ? { cache_error: cacheError } : {}),
  };

  cached = { value: payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return jsonResponse(payload);
});
