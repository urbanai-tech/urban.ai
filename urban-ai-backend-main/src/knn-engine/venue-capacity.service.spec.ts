import { buildVenueIndex, matchVenue } from './venue-capacity.service';
import { EventIdentityService } from '../evento/event-identity.service';
import { SP_VENUES } from './data/sp-venues';

describe('venue-capacity matching (IA-3c)', () => {
  // Usa a normalização REAL do produto (mesma do matching de eventos).
  const identity = new EventIdentityService();
  const normalize = (v?: string | null) => identity.normalizeVenue(v);
  const index = buildVenueIndex(normalize);

  it('indexa todos os venues do dataset', () => {
    expect(index.venues.length).toBe(SP_VENUES.length);
    expect(index.byName.size).toBeGreaterThan(0);
  });

  it('casa por nome exato (Allianz Parque)', () => {
    const m = matchVenue(index, normalize('Allianz Parque'));
    expect(m?.venue.name).toBe('Allianz Parque');
    expect(m?.method).toBe('name');
    expect(m?.venue.capacity).toBe(43000);
  });

  it('casa por alias comercial antigo (Credicard Hall -> Vibra)', () => {
    const m = matchVenue(index, normalize('Credicard Hall'));
    expect(m?.venue.name).toBe('Vibra São Paulo');
  });

  it('casa por alias de estádio (Arena Corinthians -> Neo Química)', () => {
    const m = matchVenue(index, normalize('Arena Corinthians'));
    expect(m?.venue.name).toBe('Neo Química Arena');
  });

  it('casa por substring ("show no Espaço Unimed - portão 3")', () => {
    const m = matchVenue(index, normalize('Espaço Unimed portão 3'));
    expect(m?.venue.name).toBe('Espaço Unimed');
  });

  it('colisão do Anhembi resolve para 1 venue conservador', () => {
    const a = matchVenue(index, normalize('Sambódromo do Anhembi'));
    const b = matchVenue(index, normalize('Distrito Anhembi'));
    expect(a?.venue.name).toBe('Anhembi');
    expect(b?.venue.name).toBe('Anhembi');
  });

  it('casa por geo quando o nome não bate (perto do Morumbi)', () => {
    const m = matchVenue(index, normalize('local desconhecido xyz'), -23.6011, -46.7197);
    expect(m?.venue.name).toBe('Estádio do Morumbi');
    expect(m?.method).toBe('geo');
  });

  it('não casa geo se estiver longe demais', () => {
    const m = matchVenue(index, normalize('nada'), -23.4, -46.4);
    expect(m).toBeNull();
  });

  it('retorna null quando não há nome nem geo utilizável', () => {
    expect(matchVenue(index, '', null, null)).toBeNull();
  });
});
