import pino from 'pino';
import { config } from './config.js';

// Log estruturado JSON em produção (compatível com ELK/Datadog).
// Em dev usa pino-pretty pra leitura humana — exige `pino-pretty` instalado.
const transport =
  config.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss.l',
        },
      }
    : undefined;

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'smart-scraper-worker' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.pdf_base64',
      'password',
      'SMART_PORTAL_PASS',
      'WORKER_TOKEN',
    ],
    censor: '[REDACTED]',
  },
  transport,
});

export type Logger = typeof logger;
