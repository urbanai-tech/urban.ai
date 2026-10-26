import { extractV2Suggestion } from './propriedade.helpers';

describe('extractV2Suggestion', () => {
  it('shadow: lê o v2 de details.shadowV2 (a resposta continua sendo o v1)', () => {
    expect(
      extractV2Suggestion(
        { suggestedPrice: 300, details: { shadowV2: { suggestedPrice: 281.456, engineVersion: 'pricing-engine-v2.0' } } },
        'shadow',
      ),
    ).toEqual({ price: 281.46, version: 'pricing-engine-v2.0' });
  });

  it('v2 ligado: a própria sugestão do motor é o v2', () => {
    expect(
      extractV2Suggestion({ suggestedPrice: 310, details: { engineVersion: 'pricing-engine-v2.0' } }, 'v2'),
    ).toEqual({ price: 310, version: 'pricing-engine-v2.0' });
  });

  it('v1 (v2 desligado) ou sem preço válido: null, nunca zero', () => {
    expect(extractV2Suggestion({ suggestedPrice: 300, details: { shadowV2: { suggestedPrice: 280 } } }, 'v1')).toBeNull();
    expect(extractV2Suggestion({ suggestedPrice: 300, details: {} }, 'shadow')).toBeNull();
    expect(extractV2Suggestion({ suggestedPrice: 300, details: { shadowV2: { suggestedPrice: 0 } } }, 'shadow')).toBeNull();
    expect(extractV2Suggestion({ suggestedPrice: NaN, details: {} }, 'v2')).toBeNull();
    expect(extractV2Suggestion(null, 'shadow')).toBeNull();
  });

  it('sem versão informada usa um rótulo genérico dentro do limite da coluna', () => {
    const result = extractV2Suggestion({ suggestedPrice: 300, details: { shadowV2: { suggestedPrice: 280 } } }, 'shadow');
    expect(result?.version).toBe('pricing-engine-v2');
  });
});
