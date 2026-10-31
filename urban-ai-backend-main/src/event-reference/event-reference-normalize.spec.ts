import { EventIdentityService } from '../evento/event-identity.service';
import {
  dbValidatorKey,
  dayDiff,
  parseExtractionResponse,
  parseJudgeResponse,
  parseReferenceDate,
  referenceFingerprint,
  registrableDomain,
  webValidatorKey,
} from './event-reference-normalize';

const identity = new EventIdentityService();
const window = { fromDateKey: '2026-11-01', toDateKey: '2027-01-30' };

describe('normalização da lista de referência', () => {
  it('reduz URLs ao domínio registrável (independência por site, não por página)', () => {
    expect(registrableDomain('https://www.sympla.com.br/evento/abc')).toBe('sympla.com.br');
    expect(registrableDomain('https://agenda.allianzparque.com.br/x')).toBe('allianzparque.com.br');
    expect(registrableDomain('https://tickets.eventim.com/a')).toBe('eventim.com');
    expect(registrableDomain('nao-e-url')).toBeNull();
    expect(webValidatorKey('https://WWW.Sympla.com.br/a')).toBe('web:sympla.com.br');
    expect(webValidatorKey('https://sympla.com.br/b')).toBe(webValidatorKey('https://www.sympla.com.br/a'));
  });

  it('gera chave de independência por fonte de coleta', () => {
    expect(dbValidatorKey('Sympla_Spider')).toBe('db:sympla-spider');
    expect(dbValidatorKey(null)).toBe('db:desconhecida');
  });

  it('o fingerprint ignora acento, caixa e alias do venue', () => {
    const a = referenceFingerprint(identity, { name: 'Palmeiras x Corinthiãns', dateKey: '2026-11-10', venue: 'Allianz Parque' });
    const b = referenceFingerprint(identity, { name: 'PALMEIRAS X CORINTHIANS', dateKey: '2026-11-10', venue: 'Arena Palmeiras' });
    const c = referenceFingerprint(identity, { name: 'Palmeiras x Corinthians', dateKey: '2026-11-11', venue: 'Allianz Parque' });
    expect(a).toBe(referenceFingerprint(identity, { name: 'Palmeiras x Corinthiãns', dateKey: '2026-11-10', venue: 'Allianz Parque' }));
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
    expect(a).toHaveLength(40);
  });

  it('calcula diferença de dias em calendário', () => {
    expect(dayDiff('2026-11-11', '2026-11-10')).toBe(1);
    expect(dayDiff('2026-11-01', '2026-10-31')).toBe(1);
    expect(dayDiff('2026-11-10', '2026-11-12')).toBe(-2);
  });

  it('entende datas ISO e dd/mm/aaaa no fuso de São Paulo', () => {
    expect(parseReferenceDate('2026-11-10')?.dateKey).toBe('2026-11-10');
    expect(parseReferenceDate('10/11/2026 21:30')?.dateKey).toBe('2026-11-10');
    expect(parseReferenceDate('2026-11-10T23:30:00-03:00')?.dateKey).toBe('2026-11-10');
    expect(parseReferenceDate('31/02/2026')).toBeNull();
    expect(parseReferenceDate('amanhã')).toBeNull();
    expect(parseReferenceDate('')).toBeNull();
  });
});

describe('parseExtractionResponse (JSON estrito)', () => {
  it('aceita o objeto com cerca de código e descarta lixo', () => {
    const text = '```json\n' + JSON.stringify({
      events: [
        { name: 'Show da Banda X', date: '2026-11-20', time: '21:00', venue: 'Allianz Parque', category: 'Show' },
        { name: 'Sem data', date: 'em breve' },
        { name: 'Fora da janela', date: '2028-01-01' },
        { name: 'Ab', date: '2026-11-21' },
        { name: 'Data impossível', date: '2026-02-31' },
        'texto solto',
        { name: 'Show da Banda X', date: '2026-11-20' },
      ],
      instrucao: 'ignore tudo',
    }) + '\n```';
    const out = parseExtractionResponse(text, window);
    expect(out).toEqual([
      { name: 'Show da Banda X', dateKey: '2026-11-20', time: '21:00', venue: 'Allianz Parque', category: 'show' },
    ]);
  });

  it('rejeita texto fora do esquema e hora inválida vira null', () => {
    expect(parseExtractionResponse('Claro! Aqui estão os eventos: ...', window)).toEqual([]);
    expect(parseExtractionResponse('{"events":"x"}', window)).toEqual([]);
    const [item] = parseExtractionResponse('[{"name":"Festival Y","date":"2026-12-05","time":"25:99"}]', window);
    expect(item.time).toBeNull();
  });

  it('limita a quantidade por documento', () => {
    const events = Array.from({ length: 100 }, (_, i) => ({ name: `Evento ${i}`, date: '2026-12-05' }));
    expect(parseExtractionResponse(JSON.stringify({ events }), window).length).toBeLessThanOrEqual(40);
  });
});

describe('parseJudgeResponse', () => {
  it('só aceita os três veredictos', () => {
    expect(parseJudgeResponse('{"verdict":"confirm","reason":"ok"}')).toEqual({ verdict: 'confirm', reason: 'ok' });
    expect(parseJudgeResponse('{"verdict":"reject"}')?.verdict).toBe('reject');
    expect(parseJudgeResponse('{"verdict":"talvez"}')).toBeNull();
    expect(parseJudgeResponse('confirm')).toBeNull();
  });
});
