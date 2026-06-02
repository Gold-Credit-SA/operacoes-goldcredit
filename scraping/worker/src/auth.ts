import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { logger } from './logger.js';

// Compara strings em tempo constante para evitar timing attack.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match) {
    logger.warn({ ip: req.ip, path: req.path }, 'auth: missing bearer token');
    res.status(401).json({ success: false, error_code: 'UNAUTHORIZED', message: 'Missing bearer token' });
    return;
  }

  const token = match[1].trim();
  if (!safeEqual(token, config.WORKER_TOKEN)) {
    logger.warn({ ip: req.ip, path: req.path }, 'auth: invalid bearer token');
    res.status(401).json({ success: false, error_code: 'UNAUTHORIZED', message: 'Invalid bearer token' });
    return;
  }

  next();
}
