import { SetMetadata } from '@nestjs/common';

/**
 * Marca handlers administrativos que registram a própria auditoria (com
 * before/after detalhados) via `AdminAuditService.record`. O interceptor
 * global não duplica o registro nesses handlers.
 * O audit de autorização (`npm run audit:authorization`) confere que o corpo
 * do handler realmente chama `.audit.record(`.
 */
export const ADMIN_AUDIT_EXPLICIT_KEY = 'adminAuditExplicit';
export const AdminAuditedInHandler = () => SetMetadata(ADMIN_AUDIT_EXPLICIT_KEY, true);

/**
 * Exceção revisada: NÃO registra auditoria global para o handler.
 * O audit de autorização reprova qualquer uso que não esteja na allowlist do script.
 */
export const ADMIN_AUDIT_SKIP_KEY = 'adminAuditSkip';
export const SkipAdminAudit = (reason: string) => SetMetadata(ADMIN_AUDIT_SKIP_KEY, reason);
