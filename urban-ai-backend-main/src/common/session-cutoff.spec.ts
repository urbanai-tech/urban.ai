import { Logger } from '@nestjs/common';
import { markSessionsCutoff, readSessionsCutoff, resetSessionCutoffWarning } from './session-cutoff';

describe('session-cutoff (tolerante a migration pendente)', () => {
  const missing = () =>
    Object.assign(new Error("Unknown column 'sessions_valid_after' in 'field list'"), { code: 'ER_BAD_FIELD_ERROR' });
  beforeEach(() => resetSessionCutoffWarning());

  it('lê e grava o corte quando a coluna existe', async () => {
    const cutoff = new Date('2026-10-27T12:00:00Z');
    const repo: any = { query: jest.fn().mockResolvedValueOnce([{ cutoff }]).mockResolvedValueOnce(undefined) };
    expect(await readSessionsCutoff(repo, 'u1')).toEqual(cutoff);
    expect(await markSessionsCutoff(repo, 'u1')).toBe(true);
  });

  it('coluna ausente: leitura devolve null e escrita devolve false, sem lançar', async () => {
    const repo: any = { query: jest.fn().mockRejectedValue(missing()) };
    expect(await readSessionsCutoff(repo, 'u1')).toBeNull();
    expect(await markSessionsCutoff(repo, 'u1')).toBe(false);
  });

  it('reconhece erro embrulhado em driverError e por errno 1054', async () => {
    const wrapped: any = { query: jest.fn().mockRejectedValue({ driverError: { code: 'ER_BAD_FIELD_ERROR' } }) };
    expect(await readSessionsCutoff(wrapped, 'u1')).toBeNull();
    const errno: any = { query: jest.fn().mockRejectedValue({ errno: 1054 }) };
    expect(await markSessionsCutoff(errno, 'u1')).toBe(false);
  });

  it('avisa só uma vez', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const repo: any = { query: jest.fn().mockRejectedValue(missing()) };
    await readSessionsCutoff(repo, 'u1');
    await readSessionsCutoff(repo, 'u2');
    await markSessionsCutoff(repo, 'u1');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('outros erros propagam', async () => {
    const repo: any = { query: jest.fn().mockRejectedValue(new Error('deadlock')) };
    await expect(readSessionsCutoff(repo, 'u1')).rejects.toThrow('deadlock');
    await expect(markSessionsCutoff(repo, 'u1')).rejects.toThrow('deadlock');
  });
});
