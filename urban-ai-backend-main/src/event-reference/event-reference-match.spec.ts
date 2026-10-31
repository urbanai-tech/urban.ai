import { EventIdentityService } from '../evento/event-identity.service';
import { matchReferenceToEvents, type MatchableEvent } from './event-reference-match';

const identity = new EventIdentityService();

const ref = {
  name: 'Palmeiras x Corinthians',
  dateKey: '2026-11-10',
  normalizedVenue: identity.normalizeVenue('Allianz Parque'),
  lat: -23.5273,
  lng: -46.6786,
};

const event = (over: Partial<MatchableEvent>): MatchableEvent => ({
  id: 'e1',
  nome: 'Palmeiras x Corinthians - Brasileirão',
  dataInicio: new Date('2026-11-10T22:00:00.000Z'), // 19:00 em São Paulo
  venueName: 'Arena Palmeiras',
  ...over,
});

describe('matchReferenceToEvents', () => {
  it('casa pelo nome normalizado, dia e venue (alias do dedup)', () => {
    const match = matchReferenceToEvents(ref, [event({})], identity);
    expect(match?.eventId).toBe('e1');
    expect(match?.dayOffset).toBe(0);
    expect(match!.score).toBeGreaterThanOrEqual(0.7);
  });

  it('usa o dia de São Paulo, não o dia UTC (jogo às 21h30 BRT cai no dia seguinte em UTC)', () => {
    const late = event({ dataInicio: new Date('2026-11-11T00:30:00.000Z') });
    const match = matchReferenceToEvents(ref, [late], identity);
    expect(match?.dayOffset).toBe(0);
  });

  it('tolera ±1 dia, mas não 2', () => {
    expect(matchReferenceToEvents(ref, [event({ dataInicio: new Date('2026-11-11T15:00:00.000Z') })], identity)?.dayOffset).toBe(1);
    expect(matchReferenceToEvents(ref, [event({ dataInicio: new Date('2026-11-12T15:00:00.000Z') })], identity)).toBeNull();
  });

  it('exige venue ou geo compatíveis', () => {
    expect(matchReferenceToEvents(ref, [event({ venueName: 'Estádio do Morumbi' })], identity)).toBeNull();
    const byGeo = event({ venueName: 'Av. Francisco Matarazzo, 1705', latitude: -23.5275, longitude: -46.6783 });
    expect(matchReferenceToEvents(ref, [byGeo], identity)?.eventId).toBe('e1');
    expect(matchReferenceToEvents(ref, [event({ venueName: 'Rua X', latitude: -23.7, longitude: -46.7 })], identity)).toBeNull();
  });

  it('rejeita nome muito diferente no mesmo venue e dia', () => {
    expect(matchReferenceToEvents(ref, [event({ nome: 'Festival de Jazz da Cidade' })], identity)).toBeNull();
  });

  it('escolhe o melhor candidato entre vários', () => {
    const match = matchReferenceToEvents(
      ref,
      [
        event({ id: 'dia-seguinte', dataInicio: new Date('2026-11-11T15:00:00.000Z') }),
        event({ id: 'mesmo-dia' }),
      ],
      identity,
    );
    expect(match?.eventId).toBe('mesmo-dia');
  });

  it('usa o nome canônico quando o nome cru é ruído', () => {
    const match = matchReferenceToEvents(ref, [event({ nome: 'Ingressos oficiais jogo 38', canonicalName: 'Palmeiras x Corinthians' })], identity);
    expect(match?.eventId).toBe('e1');
  });
});
