import { sanitizeForLog } from './log-sanitize';

describe('sanitizeForLog', () => {
  it('remove CR/LF para impedir forjar linhas de log', () => {
    const out = sanitizeForLog('abc\r\n[INFO] admin logou\nfim');
    expect(out).not.toMatch(/[\r\n]/);
    expect(out).toBe('abc  [INFO] admin logou fim');
  });

  it('remove outros caracteres de controle e separadores unicode de linha', () => {
    const ls = String.fromCharCode(0x2028);
    const ps = String.fromCharCode(0x2029);
    expect(sanitizeForLog(`a\x00b\x1bc${ls}d${ps}e\x7ff`)).toBe('a b c d e f');
  });

  it('preserva texto normal e acentuação', () => {
    expect(sanitizeForLog('123e4567-e89b-12d3 ação')).toBe('123e4567-e89b-12d3 ação');
  });

  it('trata valores não string e limita o tamanho', () => {
    expect(sanitizeForLog(undefined)).toBe('undefined');
    expect(sanitizeForLog(42)).toBe('42');
    expect(sanitizeForLog('x'.repeat(500), 10)).toBe('xxxxxxxxxx...');
  });
});
