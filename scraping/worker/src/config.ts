import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Schema rígido — falhar cedo se .env estiver incompleto.
const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WORKER_TOKEN: z.string().min(16, 'WORKER_TOKEN deve ter pelo menos 16 chars'),
  SMART_PORTAL_URL: z.string().url(),
  SMART_PORTAL_USER: z.string().min(1),
  SMART_PORTAL_PASS: z.string().min(1),
  SCRAPER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  SCRAPE_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  SESSION_TTL_MS: z.coerce.number().int().min(60_000).default(1_800_000),
  SESSION_STORAGE_PATH: z.string().default('./.playwright/session.json'),
  HEADLESS: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() !== 'false'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração inválida em .env:\n${errors}`);
  }
  return parsed.data;
}

export const config = loadConfig();
