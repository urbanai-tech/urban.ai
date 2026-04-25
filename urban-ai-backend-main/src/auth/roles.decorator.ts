import { SetMetadata } from '@nestjs/common';

/**
 * Decorator para marcar quais roles podem acessar um endpoint.
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin')
 *   @Get('admin/metrics')
 *   getMetrics() { ... }
 *
 * Pode aceitar múltiplos roles: `@Roles('admin', 'support')`.
 *
 * Sem o decorator, o `RolesGuard` libera (deixa o guard de auth padrão decidir).
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
