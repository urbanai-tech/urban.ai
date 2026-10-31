import { BadRequestException, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { PerMinuteThrottle } from '../common/throttle-config';
import { escapeHtml } from '../common/escape-html';
import { SubscriptionFree } from '../subscription/subscription-policy';
import { OwnerReportsService } from './owner-reports.service';

const TOKEN_SHAPE = /^[A-Za-z0-9._-]{1,100}$/;

const PAGE = (body: string) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>My Urban</title></head>` +
  `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#111">${body}</body></html>`;

/**
 * Rotas PÚBLICAS (sem login) do relatório do proprietário: leitura por token e descadastro.
 * Sem cookie, sem CORS com credencial, sem cache e nunca indexáveis; limite de requisições por IP.
 */
@SubscriptionFree()
@Controller('owner-reports')
export class OwnerReportPublicController {
  constructor(private readonly reports: OwnerReportsService) {}

  @PerMinuteThrottle(30)
  @Get('public/:token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Referrer-Policy', 'no-referrer')
  async read(@Param('token') token: string) {
    return this.reports.resolvePublic(token);
  }

  /** GET só confirma: pré-visualizadores de link não descadastram ninguém por engano. */
  @PerMinuteThrottle(20)
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async confirmPage(@Query('token') token?: string): Promise<string> {
    if (!token || !TOKEN_SHAPE.test(token) || !(await this.reports.isUnsubscribeTokenValid(token))) {
      return PAGE('<h1>Link inválido</h1><p>Este link de descadastro é inválido ou já não vale mais.</p>');
    }
    return PAGE(
      `<h1>Deixar de receber estes relatórios?</h1><p>Você não receberá mais o relatório mensal dos seus imóveis do My Urban neste e-mail.</p>` +
        `<form method="post" action="?token=${escapeHtml(token)}"><button type="submit" style="padding:10px 18px;font-size:16px">Confirmar descadastro</button></form>`,
    );
  }

  /** One-click (RFC 8058) e envio do formulário acima. Idempotente. */
  @PerMinuteThrottle(20)
  @Post('unsubscribe')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async unsubscribe(@Query('token') token?: string): Promise<{ ok: true }> {
    if (!token || !TOKEN_SHAPE.test(token) || !(await this.reports.unsubscribeOwner(token))) {
      throw new BadRequestException('Link de descadastro inválido');
    }
    return { ok: true };
  }
}
