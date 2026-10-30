import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TIMEOUT_MS = 5000;

/**
 * Verificação server-side do Cloudflare Turnstile (captcha) no cadastro público
 * da lista de espera.
 *
 *  - `TURNSTILE_SECRET_KEY` ausente: não verifica (aviso único no boot), assim o
 *    deploy sem chaves continua seguro e funcional.
 *  - Com a chave: token ausente/inválido => 400 genérico.
 *  - Erro de rede/timeout/HTTP != 2xx no Cloudflare: falha fechada (503) a menos que
 *    `TURNSTILE_FAIL_OPEN=true`, que deixa o cadastro passar (com aviso no log).
 */
@Injectable()
export class TurnstileService implements OnModuleInit {
  private readonly logger = new Logger(TurnstileService.name);

  onModuleInit(): void {
    if (!this.secret()) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY não definida: captcha do cadastro da waitlist DESATIVADO (sem verificação).',
      );
    }
  }

  isEnabled(): boolean {
    return !!this.secret();
  }

  async verify(token: string | undefined, remoteIp?: string | null): Promise<void> {
    const secret = this.secret();
    if (!secret) return;

    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('Verificação de segurança inválida. Tente novamente.');
    }

    let success: boolean;
    try {
      const res = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
        signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { success?: boolean };
      success = data?.success === true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'erro desconhecido';
      if (process.env.TURNSTILE_FAIL_OPEN === 'true') {
        this.logger.warn(`Turnstile indisponível (${reason}); TURNSTILE_FAIL_OPEN=true, cadastro liberado.`);
        return;
      }
      this.logger.error(`Turnstile indisponível (${reason}); cadastro recusado (fail closed).`);
      throw new ServiceUnavailableException(
        'Não foi possível validar a verificação de segurança agora. Tente novamente em instantes.',
      );
    }

    if (!success) {
      throw new BadRequestException('Verificação de segurança inválida. Tente novamente.');
    }
  }

  private secret(): string {
    return process.env.TURNSTILE_SECRET_KEY?.trim() ?? '';
  }
}
