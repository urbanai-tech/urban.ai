import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { TERMS_VERSION } from './terms.constants';

const MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', 'março': '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

describe('TERMS_VERSION', () => {
  it('tem formato de data ISO (AAAA-MM-DD)', () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // O monorepo traz o front ao lado; em checkouts só do backend o teste é ignorado.
  const frontRoot = resolve(__dirname, '../../../Urban-front-main/src/app');
  const legal = resolve(frontRoot, '(public)/legalContent.ts');
  const frontTerms = resolve(frontRoot, 'lib/terms.ts');
  const maybe = existsSync(legal) ? it : it.skip;

  maybe('bate com TERMS_UPDATED_AT do legalContent.ts do front', () => {
    const source = readFileSync(legal, 'utf8');
    const match = source.match(/TERMS_UPDATED_AT\s*=\s*'(\d{1,2}) de (\p{L}+) de (\d{4})'/u);
    expect(match).not.toBeNull();
    const [, day, month, year] = match as RegExpMatchArray;
    expect(`${year}-${MONTHS[month.toLowerCase()]}-${day.padStart(2, '0')}`).toBe(TERMS_VERSION);
  });

  (existsSync(frontTerms) ? it : it.skip)('bate com TERMS_VERSION do front (lib/terms.ts)', () => {
    const source = readFileSync(frontTerms, 'utf8');
    expect(source).toContain(`TERMS_VERSION = "${TERMS_VERSION}"`);
  });
});
