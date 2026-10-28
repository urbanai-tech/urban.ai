import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { PER_MINUTE_THROTTLER, THROTTLER_NAMES } from './throttle-config';

/** Lista todos os .ts de produção (sem specs) sob src/. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

/** Texto entre os parênteses que abrem em `start` (balanceado). */
function callArgs(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '(') depth++;
    if (source[i] === ')' && --depth === 0) return source.slice(start + 1, i);
  }
  return '';
}

/** Chaves de nível 1 do objeto literal passado ao decorator. */
function topLevelKeys(args: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let token = '';
  for (const ch of args) {
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    if (ch === '}' || ch === ')' || ch === ']') depth--;
    if (depth === 1 && (ch === ',' || ch === '{')) token = '';
    else if (depth === 1 && ch === ':') {
      keys.push(token.trim().replace(/^['"]|['"]$/g, ''));
      token = '';
    } else if (depth === 1) token += ch;
  }
  return keys;
}

describe('nomes de throttler em @Throttle/@SkipThrottle', () => {
  const root = join(__dirname, '..');
  const offenders: string[] = [];

  for (const file of sourceFiles(root)) {
    // remove comentários para não acusar menções em texto
    const blank = (c: string) => c.replace(/[^\n]/g, ' ');
    const source = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      .replace(/\/\/.*$/gm, blank);
    const re = /@(Throttle|SkipThrottle)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const args = callArgs(source, m.index + m[0].length - 1).trim();
      // @SkipThrottle() sem argumento vale para o throttler "default", que não existe.
      const keys = args === '' ? ['default'] : topLevelKeys(args);
      for (const key of keys) {
        if (!THROTTLER_NAMES.includes(key)) {
          offenders.push(`${file.slice(root.length + 1)}: @${m[1]} usa "${key}"`);
        }
      }
    }
  }

  it('não existe throttler chamado "default" na configuração real', () => {
    expect(THROTTLER_NAMES).toEqual(['short', 'medium']);
  });

  it('o throttler usado por PerMinuteThrottle está registrado', () => {
    expect(THROTTLER_NAMES).toContain(PER_MINUTE_THROTTLER);
  });

  it('o scanner enxerga as chaves (sanidade)', () => {
    expect(topLevelKeys("{ default: { ttl: 1, limit: 2 }, 'x': { a: 1 } }")).toEqual(['default', 'x']);
  });

  it('toda chave de @Throttle/@SkipThrottle é um throttler registrado', () => {
    expect(offenders).toEqual([]);
  });
});
