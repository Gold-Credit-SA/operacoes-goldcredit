import express, { type Request, type Response, type NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { bearerAuth } from './auth.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { enqueueScrape, queueStats } from './queue.js';
import { smartSession } from './session.js';

const app = express();

// 5 MB de body: o payload da edge é pequeno (JSON com IDs), mas damos folga.
app.use(express.json({ limit: '256kb' }));

// Request logger estruturado.
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Não logar /health (ruído de health-check) salvo erro.
    autoLogging: { ignore: (req) => req.url === '/health' },
  }),
);

// =============================================================================
// GET /health — status público (sem auth) pra Nginx/Render checar.
// =============================================================================
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'smart-scraper-worker',
    uptime_s: Math.round(process.uptime()),
    queue: queueStats(),
  });
});

// =============================================================================
// POST /scrape — endpoint principal, exige Bearer token.
// =============================================================================
const ScrapeBodySchema = z.object({
  titulo_id: z.union([z.string(), z.number()]),
  tipo: z.enum(['boleto', 'nf']),
  nosso_numero: z.string().optional().nullable(),
  documento: z.string().optional().nullable(),
  cedente_id: z.string().optional().nullable(),
  cedente_documento: z.string().optional().nullable(),
  extra: z.record(z.unknown()).optional(),
});

app.post('/scrape', bearerAuth, async (req: Request, res: Response) => {
  const parsed = ScrapeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error_code: 'BAD_REQUEST',
      message: 'Payload inválido',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }

  const result = await enqueueScrape(parsed.data);

  if (result.success) {
    res.status(200).json({
      success: true,
      pdf_base64: result.pdf_base64,
      mime: result.mime,
      bytes: result.bytes,
      fetched_at: result.fetched_at,
    });
    return;
  }

  res.status(result.http_status).json({
    success: false,
    error_code: result.error_code,
    message: result.message,
  });
});

// =============================================================================
// Error handler de último recurso.
// =============================================================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'unhandled error');
  res.status(500).json({
    success: false,
    error_code: 'INTERNAL_ERROR',
    message: err.message,
  });
});

// =============================================================================
// Bootstrap
// =============================================================================
const server = app.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      concurrency: config.SCRAPER_CONCURRENCY,
      headless: config.HEADLESS,
    },
    'smart-scraper-worker listening',
  );
});

// Pre-warm: já loga no portal na subida pra evitar primeira request ficar lenta.
(async () => {
  try {
    await smartSession.getContext();
    logger.info('initial smart portal login OK');
  } catch (err) {
    logger.error({ err }, 'initial portal login failed (worker keeps running, will retry on demand)');
  }
})();

// Shutdown graceful.
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  server.close(() => logger.info('http server closed'));
  await smartSession.close();
  setTimeout(() => process.exit(0), 1_500).unref();
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});
