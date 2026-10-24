import { redactForAudit } from './admin-audit.redact';

describe('redactForAudit', () => {
  it('redige segredos, mascara e-mails e omite texto livre', () => {
    expect(
      redactForAudit({ password: 'x', email: 'ana@example.com', html: '<p>oi</p>', nome: 'Ana' }),
    ).toEqual({
      password: '[REDACTED]',
      email: 'a***@example.com',
      html: '[omitted:9 chars]',
      nome: 'Ana',
    });
  });

  it('descarta chaves que alteram protótipo sem poluir Object.prototype', () => {
    const body = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1},"ok":1}');
    const out = redactForAudit(body) as Record<string, unknown>;

    expect(Object.keys(out)).toEqual(['ok']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });

  it('aplica a mesma proteção em objetos aninhados', () => {
    const body = JSON.parse('{"perfil":{"__proto__":{"admin":true},"cidade":"SP"}}');
    expect(redactForAudit(body)).toEqual({ perfil: { cidade: 'SP' } });
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});
