import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { EntitlementService } from './entitlement.service';
import { EntitlementDecision } from './entitlement';
import { resolveRoutePolicy } from './subscription-policy';

export const SUBSCRIPTION_REQUIRED_CODE = 'SUBSCRIPTION_REQUIRED';

/** Autentica via a mesma estratégia JWT das rotas (cookie httpOnly ou Bearer). */
class JwtAuthenticator extends AuthGuard('jwt') {}

/**
 * Guard GLOBAL (APP_GUARD) de assinatura.
 *
 * Guards globais rodam ANTES dos guards de controller, então `req.user` ainda não
 * existe: nas rotas 'paid' o próprio guard autentica com a estratégia JWT (a
 * falha continua sendo 401). Rotas 'free', 'role' (admin/support, decididas pelo
 * RolesGuard) e não classificadas passam direto.
 *
 * Sem direito de uso => HTTP 402 `{ code: 'SUBSCRIPTION_REQUIRED', reason, ... }`,
 * que o front converte no paywall (não é 403, então não vai para /forbidden).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);
  private readonly authenticator = new JwtAuthenticator();
  private readonly warnedUnclassified = new Set<string>();

  constructor(
    private readonly reflector: Reflector,
    private readonly entitlement: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const classRef = context.getClass();
    const handlerRef = context.getHandler();
    const policy = resolveRoutePolicy(this.reflector, classRef, handlerRef);

    if (policy === 'unclassified') {
      const id = `${classRef.name}.${handlerRef.name}`;
      if (!this.warnedUnclassified.has(id)) {
        this.warnedUnclassified.add(id);
        this.logger.warn(`Rota sem política de assinatura (liberada): ${id}`);
      }
      return true;
    }
    if (policy !== 'paid') return true;

    const request = context.switchToHttp().getRequest();
    if (!request.user) {
      await this.authenticator.canActivate(context);
    }

    const userId: string | undefined = request.user?.userId ?? request.user?.id;
    if (!userId) throw new UnauthorizedException('Usuário não autenticado.');
    if (request.user?.role === 'admin') return true;

    const decision = await this.entitlement.getEntitlement(userId);
    if (decision.entitled) return true;

    throw this.subscriptionRequired(decision);
  }

  private subscriptionRequired(decision: EntitlementDecision): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: SUBSCRIPTION_REQUIRED_CODE,
        error: 'Payment Required',
        message: 'Assinatura ativa necessária para acessar este recurso. Escolha um plano para continuar.',
        reason: decision.reason,
        ...(decision.graceEndsAt ? { graceEndsAt: decision.graceEndsAt.toISOString() } : {}),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
