import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { TURNSTILE_VERIFY_URL, TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let service: TurnstileService;

  const respond = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => body }) as unknown as Response;

  beforeEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_FAIL_OPEN;
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new TurnstileService();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('sem TURNSTILE_SECRET_KEY: não verifica e deixa passar (mesmo sem token)', async () => {
    await expect(service.verify(undefined, '198.51.100.7')).resolves.toBeUndefined();
    expect(service.isEnabled()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('avisa uma vez no boot quando a chave não está definida', () => {
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    service.onModuleInit();
    expect(warn).toHaveBeenCalledTimes(1);

    process.env.TURNSTILE_SECRET_KEY = 'secret';
    service.onModuleInit();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  describe('com TURNSTILE_SECRET_KEY', () => {
    beforeEach(() => {
      process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    });

    it('token válido passa e envia secret, response e remoteip (IP real)', async () => {
      fetchMock.mockResolvedValue(respond({ success: true }));

      await expect(service.verify('tok-123', '198.51.100.7')).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(TURNSTILE_VERIFY_URL);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        secret: 'secret-key',
        response: 'tok-123',
        remoteip: '198.51.100.7',
      });
      expect(init.signal).toBeDefined();
    });

    it('token inválido (success=false) retorna 400 genérico', async () => {
      fetchMock.mockResolvedValue(respond({ success: false, 'error-codes': ['invalid-input-response'] }));

      const attempt = service.verify('tok-ruim', '198.51.100.7');
      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toThrow('Verificação de segurança inválida');
    });

    it.each([undefined, '', '   '])('token ausente (%p) retorna 400 sem chamar o Cloudflare', async (token) => {
      await expect(service.verify(token as string | undefined, '198.51.100.7')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('erro de rede falha fechado (503) por padrão', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

      await expect(service.verify('tok', '198.51.100.7')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('HTTP 5xx do Cloudflare também falha fechado', async () => {
      fetchMock.mockResolvedValue(respond({}, false, 502));
      jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

      await expect(service.verify('tok', '198.51.100.7')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('erro de rede com TURNSTILE_FAIL_OPEN=true deixa passar', async () => {
      process.env.TURNSTILE_FAIL_OPEN = 'true';
      fetchMock.mockRejectedValue(new Error('timeout'));
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

      await expect(service.verify('tok', '198.51.100.7')).resolves.toBeUndefined();
    });

    it('TURNSTILE_FAIL_OPEN não afeta resposta explícita de token inválido', async () => {
      process.env.TURNSTILE_FAIL_OPEN = 'true';
      fetchMock.mockResolvedValue(respond({ success: false }));

      await expect(service.verify('tok-ruim', '198.51.100.7')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
