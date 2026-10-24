import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { ROLES_KEY } from '../auth/roles.decorator';
import { ADMIN_AUDIT_EXPLICIT_KEY, ADMIN_AUDIT_SKIP_KEY } from './admin-audit.decorator';
import { redactForAudit } from './admin-audit.redact';
import { AdminAuditService } from './admin-audit.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUDITED_ROLES = new Set(['admin', 'support']);

/**
 * Trilha de auditoria para TODA mutação administrativa (@Roles('admin'|'support')).
 * Registra quem (ator), o quê (método + rota), alvo (id da rota), corpo redigido e
 * o resultado (success/failed). Handlers que já gravam auditoria detalhada usam
 * @AdminAuditedInHandler() e não são duplicados.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AdminAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const method = String(req?.method ?? '').toUpperCase();
    if (!MUTATING_METHODS.has(method)) return next.handle();

    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets) ?? [];
    if (!roles.some((role) => AUDITED_ROLES.has(role))) return next.handle();
    if (this.reflector.getAllAndOverride<boolean>(ADMIN_AUDIT_EXPLICIT_KEY, targets)) return next.handle();
    if (this.reflector.getAllAndOverride<string>(ADMIN_AUDIT_SKIP_KEY, targets)) return next.handle();

    let written = false;
    const write = (outcome: 'success' | 'failed', error?: any) => {
      if (written) return;
      written = true;
      const res = context.switchToHttp().getResponse();
      const params = (req?.params ?? {}) as Record<string, string>;
      const routePath: string = req?.route?.path ?? String(req?.originalUrl ?? req?.url ?? '').split('?')[0];
      void this.audit.record({
        actorUserId: req?.user?.userId ?? req?.user?.id ?? null,
        action: `${method} ${routePath}`,
        entityType: context.getClass().name.replace(/Controller$/, ''),
        entityId: params.id ?? params.userId ?? params.usuarioId ?? Object.values(params)[0] ?? null,
        before: null,
        after: redactForAudit(req?.body ?? null),
        metadata: {
          handler: `${context.getClass().name}.${context.getHandler().name}`,
          outcome,
          statusCode: outcome === 'success' ? res?.statusCode ?? null : error?.status ?? error?.getStatus?.() ?? 500,
          error: outcome === 'failed' ? String(error?.message ?? error).slice(0, 200) : undefined,
          params: redactForAudit(params),
          queryKeys: Object.keys(req?.query ?? {}),
          ip: req?.ip ?? null,
        },
      });
    };

    return next.handle().pipe(
      tap({
        next: () => write('success'),
        error: (error) => write('failed', error),
      }),
    );
  }
}
