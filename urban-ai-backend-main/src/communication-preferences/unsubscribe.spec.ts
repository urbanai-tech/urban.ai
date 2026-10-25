import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { MailerService } from '../mailer/mailer.service';
import { CommunicationPreferencesService } from './communication-preferences.service';
import {
  buildListUnsubscribeHeaders,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token';
import { UnsubscribeController } from './unsubscribe.controller';

jest.mock('axios');

const USER_ID = '8b3f0a52-6f47-4d0c-9a39-1d6a4f2a9c11';

describe('unsubscribe token (HMAC)', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, UNSUBSCRIBE_TOKEN_SECRET: 'segredo-de-teste', API_URL: 'https://api.exemplo.com/' };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('assina e verifica; qualquer adulteração é rejeitada', () => {
    const token = createUnsubscribeToken(USER_ID, 'onboarding')!;
    expect(verifyUnsubscribeToken(token)).toEqual({ userId: USER_ID, category: 'onboarding' });

    const [v, , category, sig] = token.split('.');
    expect(verifyUnsubscribeToken([v, '11111111-6f47-4d0c-9a39-1d6a4f2a9c11', category, sig].join('.'))).toBeNull();
    expect(verifyUnsubscribeToken([v, USER_ID, 'marketing', sig].join('.'))).toBeNull();
    expect(verifyUnsubscribeToken(`${token}x`)).toBeNull();
    expect(verifyUnsubscribeToken('lixo')).toBeNull();
    expect(verifyUnsubscribeToken(undefined)).toBeNull();
  });

  it('token assinado com outro segredo não vale', () => {
    const token = createUnsubscribeToken(USER_ID, 'weekly_report')!;
    process.env.UNSUBSCRIBE_TOKEN_SECRET = 'outro-segredo';
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it('sem segredo configurado não gera nem aceita token (fail-closed)', () => {
    delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    delete process.env.JWT_SECRET;
    expect(createUnsubscribeToken(USER_ID, 'onboarding')).toBeNull();
    expect(buildListUnsubscribeHeaders(USER_ID, 'onboarding')).toBeNull();
  });

  it('monta os headers RFC 8058', () => {
    const headers = buildListUnsubscribeHeaders(USER_ID, 'onboarding')!;
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(headers['List-Unsubscribe']).toMatch(/^<https:\/\/api\.exemplo\.com\/unsubscribe\?token=v1\./);
  });
});

describe('UnsubscribeController', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, UNSUBSCRIBE_TOKEN_SECRET: 'segredo-de-teste' };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  function make(row: any) {
    const repo = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn(async (value) => value),
      create: jest.fn((value) => value),
    };
    const service = new CommunicationPreferencesService(repo as any);
    return { controller: new UnsubscribeController(service), repo };
  }

  it('POST com token válido desliga a preferência, sem login, e é idempotente', async () => {
    const row = { userId: USER_ID, onboardingEmails: true, marketing: false };
    const { controller, repo } = make(row);
    const token = createUnsubscribeToken(USER_ID, 'onboarding')!;

    await expect(controller.unsubscribe(token)).resolves.toEqual({ ok: true });
    expect(row.onboardingEmails).toBe(false);
    expect(repo.save).toHaveBeenCalledTimes(1);

    await expect(controller.unsubscribe(token)).resolves.toEqual({ ok: true });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('token inválido => 400 e nada é alterado', async () => {
    const { controller, repo } = make({ userId: USER_ID, onboardingEmails: true });
    await expect(controller.unsubscribe('v1.x.onboarding.assinatura')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.unsubscribe(undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('GET só mostra confirmação e não altera nada (pré-visualizadores de link)', () => {
    const { controller, repo } = make({ userId: USER_ID, onboardingEmails: true });
    const token = createUnsubscribeToken(USER_ID, 'onboarding')!;
    expect(controller.confirmPage(token)).toContain('method="post"');
    expect(controller.confirmPage('invalido')).toContain('Link inválido');
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('MailerService List-Unsubscribe', () => {
  const originalEnv = process.env;
  const post = axios.post as jest.Mock;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'k',
      UNSUBSCRIBE_TOKEN_SECRET: 'segredo-de-teste',
      API_URL: 'https://api.exemplo.com',
    };
    post.mockReset().mockResolvedValue({ status: 201, data: { messageId: 'm1' } });
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('e-mail não transacional leva List-Unsubscribe e One-Click', async () => {
    await new MailerService().sendHtmlEmail({ email: 'a@b.com' }, 'Oi', '<p>x</p>', {
      unsubscribe: { userId: USER_ID, category: 'onboarding' },
    });

    const payload = post.mock.calls[0][1];
    expect(payload.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(payload.headers['List-Unsubscribe']).toContain('/unsubscribe?token=');
  });

  it('e-mail transacional (sem opção) NÃO leva o header', async () => {
    await new MailerService().sendHtmlEmail({ email: 'a@b.com' }, 'Redefinir senha', '<p>x</p>');
    expect(post.mock.calls[0][1].headers).toBeUndefined();
  });
});
