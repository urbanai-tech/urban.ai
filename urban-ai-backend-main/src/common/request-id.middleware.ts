import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/nestjs';

/**
 * OBS-2 — correlationId por request.
 *
 * Usa o header `x-request-id` recebido (se houver) ou gera um UUID. Expõe em
 * `req.id`, devolve no header de resposta e marca no escopo do Sentry — assim
 * um erro capturado carrega o mesmo id que aparece nos logs/response, permitindo
 * rastrear uma requisição ponta a ponta.
 *
 * Aditivo: não altera nenhum comportamento existente.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id =
    (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() || randomUUID();
  (req as any).id = id;
  res.setHeader('x-request-id', id);
  try {
    Sentry.getCurrentScope().setTag('request_id', id);
  } catch {
    // Sentry pode não estar inicializado (ex.: testes) — ignora.
  }
  next();
}
