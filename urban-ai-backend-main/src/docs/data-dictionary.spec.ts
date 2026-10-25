import * as fs from 'fs';
import { buildDictionary, DOC_PATH, spliceGenerated } from '../../scripts/generate-data-dictionary';

// Barra drift: mudou uma entidade sem regenerar docs/DICIONARIO-DE-DADOS.md?
// Correção: `npm run docs:data-dictionary` (em urban-ai-backend-main) e commitar.
describe('dicionário de dados', () => {
  it('não tem tabela sem domínio nem coluna de PII inexistente', async () => {
    const { problems } = await buildDictionary();
    expect(problems).toEqual([]);
  }, 60000);

  it('docs/DICIONARIO-DE-DADOS.md está em dia com as entidades', async () => {
    const { markdown } = await buildDictionary();
    const existing = fs.readFileSync(DOC_PATH, 'utf8').replace(/\r\n/g, '\n');
    const expected = spliceGenerated(existing, markdown);
    if (existing !== expected) {
      throw new Error('docs/DICIONARIO-DE-DADOS.md desatualizado. Rode `npm run docs:data-dictionary` em urban-ai-backend-main e faça commit.');
    }
  }, 60000);
});
