import type { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import {
  normalizeRequestId,
  resolveObservabilityRuntime,
  safeRouteTemplate,
} from './observability';

const httpLogger = new Logger('HTTP');

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
  const id = normalizeRequestId(incoming);
  const startedAt = process.hrtime.bigint();
  (req as any).id = id;
  res.setHeader('x-request-id', id);
  try {
    const scope = Sentry.getCurrentScope();
    scope.setTag('request_id', id);
    scope.setContext('request_correlation', { requestId: id });
  } catch {
    // Sentry pode não estar inicializado (ex.: testes) — ignora.
  }
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const runtime = resolveObservabilityRuntime();
    httpLogger.log(
      JSON.stringify({
        event: 'http_request',
        requestId: id,
        method: req.method,
        route: safeRouteTemplate(req),
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        environment: runtime.environment,
        release: runtime.release,
      }),
    );
  });
  next();
}
