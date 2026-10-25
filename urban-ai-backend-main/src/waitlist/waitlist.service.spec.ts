import { randomInt } from 'crypto';
import { WaitlistService } from './waitlist.service';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomInt: jest.fn(actual.randomInt) };
});

describe('WaitlistService.generateUniqueReferralCode', () => {
  const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

  function build(findOne: jest.Mock) {
    return new WaitlistService({ findOne } as any, {} as any) as any;
  }

  it('gera 8 caracteres do alfabeto sem ambiguidades', async () => {
    const svc = build(jest.fn().mockResolvedValue(null));
    for (let i = 0; i < 50; i++) {
      const code: string = await svc.generateUniqueReferralCode();
      expect(code).toHaveLength(8);
      for (const ch of code) expect(ALPHABET).toContain(ch);
    }
  });

  it('usa crypto.randomInt (sem viés de módulo) com o tamanho exato do alfabeto', async () => {
    const spy = randomInt as unknown as jest.Mock;
    spy.mockClear();
    const svc = build(jest.fn().mockResolvedValue(null));
    await svc.generateUniqueReferralCode();
    expect(spy).toHaveBeenCalledTimes(8);
    for (const call of spy.mock.calls) expect(call[0]).toBe(ALPHABET.length);
  });

  it('tenta de novo quando o código já existe', async () => {
    const findOne = jest.fn().mockResolvedValueOnce({ id: 1 }).mockResolvedValue(null);
    const svc = build(findOne);
    const code: string = await svc.generateUniqueReferralCode();
    expect(code).toHaveLength(8);
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});
