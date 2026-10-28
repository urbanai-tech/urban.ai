import { BadRequestException, Controller, Get, Header, HttpCode, Post, Query } from '@nestjs/common';
import { PerMinuteThrottle } from '../common/throttle-config';
import { CommunicationPreferencesService } from './communication-preferences.service';
import { verifyUnsubscribeToken } from './unsubscribe-token';

const TOKEN_SHAPE = /^[A-Za-z0-9._-]{1,256}$/;

const PAGE = (body: string) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>My Urban</title></head>` +
  `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#111">${body}</body></html>`;

/**
 * Endpoint público (sem login) de descadastro. POST é o "one-click" dos clientes
 * de e-mail (RFC 8058); GET só mostra uma confirmação, para que pré-visualizadores
 * de link não descadastrem ninguém por engano.
 */
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly preferences: CommunicationPreferencesService) {}

  @PerMinuteThrottle(20)
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  confirmPage(@Query('token') token?: string): string {
    if (!token || !TOKEN_SHAPE.test(token) || !verifyUnsubscribeToken(token)) {
      return PAGE('<h1>Link inválido</h1><p>Este link de descadastro é inválido. Ajuste suas preferências em Configurações &gt; Comunicações no app.</p>');
    }
    return PAGE(
      `<h1>Cancelar estes e-mails?</h1><p>Você deixará de receber este tipo de e-mail do My Urban. E-mails essenciais da conta (confirmação, senha, cobrança) continuam sendo enviados.</p>` +
        `<form method="post" action="?token=${token}"><button type="submit" style="padding:10px 18px;font-size:16px">Confirmar descadastro</button></form>`,
    );
  }

  @PerMinuteThrottle(20)
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async unsubscribe(@Query('token') token?: string): Promise<{ ok: true }> {
    const verified = verifyUnsubscribeToken(token);
    if (!verified) throw new BadRequestException('Link de descadastro inválido');
    await this.preferences.unsubscribe(verified.userId, verified.category);
    return { ok: true };
  }
}
