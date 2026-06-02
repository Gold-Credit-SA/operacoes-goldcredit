import PQueue from 'p-queue';
import { config } from './config.js';
import { logger } from './logger.js';
import { scrape, type ScrapePayload, type ScrapeResult } from './scraper.js';

// Fila com concorrência limitada (default 2). Protege a sessão do portal de
// múltiplos logins simultâneos e segura uso de RAM.
const queue = new PQueue({
  concurrency: config.SCRAPER_CONCURRENCY,
  timeout: config.SCRAPE_TIMEOUT_MS + 10_000, // queue timeout > scrape timeout
  throwOnTimeout: true,
});

// Dedup: se já há um scrape em andamento pro mesmo (titulo_id, tipo),
// reaproveita a promise — evita scrape redundante quando dois jobs idênticos
// chegam em paralelo.
const inflight = new Map<string, Promise<ScrapeResult>>();

function dedupKey(p: ScrapePayload): string {
  return `${p.tipo}:${p.titulo_id}`;
}

export async function enqueueScrape(payload: ScrapePayload): Promise<ScrapeResult> {
  const key = dedupKey(payload);
  const existing = inflight.get(key);
  if (existing) {
    logger.debug({ key }, 'dedup: reusing in-flight scrape');
    return existing;
  }

  const promise = queue
    .add(() => scrape(payload), { throwOnTimeout: true })
    .then((res) => {
      if (!res) {
        return { success: false as const, error_code: 'INTERNAL_ERROR' as const, message: 'queue returned undefined', http_status: 500 };
      }
      return res;
    })
    .catch((e): ScrapeResult => {
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = /timeout/i.test(msg) || (e as { name?: string })?.name === 'TimeoutError';
      return {
        success: false,
        error_code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
        message: msg,
        http_status: isTimeout ? 504 : 500,
      };
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function queueStats() {
  return {
    pending: queue.pending,
    waiting: queue.size,
    inflight: inflight.size,
    concurrency: config.SCRAPER_CONCURRENCY,
  };
}
