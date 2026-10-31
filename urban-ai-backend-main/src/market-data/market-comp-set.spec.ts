import { customers, externals, rec, TARGET, TEST_CONFIG } from './__fixtures__/market-fixtures-spec';
import { buildCompSet, CompSetOptions, mergeAcrossSources } from './market-comp-set';

const base: CompSetOptions = {
  target: TARGET,
  radiusKm: 3,
  typology: null,
  use: 'display',
  config: TEST_CONFIG,
  today: '2026-10-31',
};

describe('mergeAcrossSources — precedência e deduplicação', () => {
  it('o mesmo anúncio (id do Airbnb) em duas fontes conta UMA vez, e vence a de maior precedência', () => {
    const fromCustomer = rec({ source: 'customers', sourceListingId: 'c1', dedupKey: 'abnb:123', adr: 310 });
    const fromLicensed = rec({ source: 'licensed_dataset', sourceListingId: 'x', dedupKey: 'abnb:123', adr: 290 });
    const fromInside = rec({ source: 'inside_airbnb', sourceListingId: '123', dedupKey: 'abnb:123', adr: 280 });

    const merged = mergeAcrossSources([fromInside, fromLicensed, fromCustomer]);

    expect(merged.records).toHaveLength(1);
    expect(merged.records[0].source).toBe('customers');
    expect(merged.records[0].adr).toBe(310);
    expect(merged.duplicatesRemoved.byId).toBe(2);
  });

  it('ordem de precedência: clientes > dataset licenciado > Inside Airbnb > coleta própria', () => {
    const mk = (source: any) => rec({ source, sourceListingId: source, dedupKey: 'abnb:7', ownerKey: null });
    const winner = (sources: string[]) => mergeAcrossSources(sources.map(mk)).records[0].source;
    expect(winner(['own_scraping', 'inside_airbnb', 'licensed_dataset'])).toBe('licensed_dataset');
    expect(winner(['own_scraping', 'inside_airbnb'])).toBe('inside_airbnb');
    expect(winner(['own_scraping', 'customers'])).toBe('customers');
  });

  it('na mesma fonte, vence a coleta mais recente', () => {
    const old = rec({ source: 'licensed_dataset', sourceListingId: 'a', dedupKey: 'abnb:5', adr: 200, collectedAt: '2026-01-10' });
    const fresh = rec({ source: 'licensed_dataset', sourceListingId: 'b', dedupKey: 'abnb:5', adr: 260, collectedAt: '2026-09-10' });
    expect(mergeAcrossSources([old, fresh]).records[0].adr).toBe(260);
  });

  it('o vencedor herda campos vazios das fontes perdedoras (preenche lacunas) e registra de onde', () => {
    const winner = rec({ source: 'customers', sourceListingId: 'c', dedupKey: 'abnb:9', occupancy: null, bedrooms: null });
    const loser = rec({
      source: 'inside_airbnb',
      sourceListingId: '9',
      dedupKey: 'abnb:9',
      occupancy: 0.4,
      occupancyIsProxy: true,
      bedrooms: 2,
    });
    const [merged] = mergeAcrossSources([winner, loser]).records;
    expect(merged.source).toBe('customers');
    expect(merged.bedrooms).toBe(2);
    expect(merged.occupancy).toBe(0.4);
    expect(merged.occupancyIsProxy).toBe(true);
    expect(merged.filledFrom).toEqual(['inside_airbnb']);
  });

  it('sem id em comum: fontes DIFERENTES na mesma posição, mesmo tipo e diária próxima viram um só', () => {
    const a = rec({ source: 'licensed_dataset', sourceListingId: 'a', adr: 300 });
    const b = rec({ source: 'inside_airbnb', sourceListingId: 'b', adr: 320 }); // +6,7%
    const merged = mergeAcrossSources([a, b]);
    expect(merged.records).toHaveLength(1);
    expect(merged.records[0].source).toBe('licensed_dataset');
    expect(merged.duplicatesRemoved.byMatch).toBe(1);
  });

  it('não junta por posição quando a diária difere muito, o tipo é outro ou falta tipologia', () => {
    const a = rec({ source: 'licensed_dataset', sourceListingId: 'a', adr: 300 });
    expect(mergeAcrossSources([a, rec({ source: 'inside_airbnb', sourceListingId: 'b', adr: 450 })]).records).toHaveLength(2);
    expect(
      mergeAcrossSources([a, rec({ source: 'inside_airbnb', sourceListingId: 'c', adr: 300, listingType: 'private_room' })]).records,
    ).toHaveLength(2);
    expect(
      mergeAcrossSources([a, rec({ source: 'inside_airbnb', sourceListingId: 'd', adr: 300, bedrooms: null })]).records,
    ).toHaveLength(2);
  });

  it('nunca junta por posição dois registros da MESMA fonte (prédio com unidades iguais)', () => {
    const unit1 = rec({ source: 'customers', sourceListingId: 'u1', adr: 300 });
    const unit2 = rec({ source: 'customers', sourceListingId: 'u2', adr: 300 });
    expect(mergeAcrossSources([unit1, unit2]).records).toHaveLength(2);
  });
});

describe('buildCompSet — filtros', () => {
  it('exclui o próprio imóvel: mesmo dono, mesmo id do Airbnb e réplica externa no mesmo ponto', () => {
    const own = rec({ source: 'customers', sourceListingId: 'mine', ownerKey: TARGET.userId });
    const sameAirbnb = rec({ source: 'licensed_dataset', sourceListingId: 'x', dedupKey: 'abnb:9999999999' });
    // réplica sem id: mesma coordenada (4 casas), mesmos quartos e diária ~ igual à do alvo
    const replica = rec({
      source: 'inside_airbnb',
      sourceListingId: 'r',
      latitude: TARGET.latitude as number,
      longitude: TARGET.longitude as number,
      adr: 310,
    });
    const result = buildCompSet([own, sameAirbnb, replica, ...customers(5)], base);
    expect(result.excluded.self).toBe(3);
    expect(result.records).toHaveLength(5);
  });

  it('respeita o raio exato e a tipologia', () => {
    const far = rec({ source: 'customers', sourceListingId: 'far', latitude: -23.7, longitude: -46.68, adr: 250 });
    const twoRooms = rec({ source: 'customers', sourceListingId: 'two', bedrooms: 2, adr: 250 });
    const near = customers(5);
    const noFilter = buildCompSet([far, twoRooms, ...near], base);
    expect(noFilter.records.map((r) => r.sourceListingId)).not.toContain('far');
    expect(noFilter.excluded.outsideRadiusOrTypology).toBe(1);
    const oneRoom = buildCompSet([twoRooms, ...near], { ...base, typology: { rooms: 1 } });
    expect(oneRoom.records.map((r) => r.sourceListingId)).not.toContain('two');
    const wider = buildCompSet([far, ...near], { ...base, radiusKm: 5 });
    expect(wider.records.map((r) => r.sourceListingId)).not.toContain('far'); // ~16 km: fora até de 5 km
  });

  it('raio maior inclui o que o menor deixava de fora', () => {
    const at4km = rec({ source: 'customers', sourceListingId: 'p4', latitude: -23.5612 - 4 / 111.32, longitude: -46.6821, adr: 250 });
    const at1 = buildCompSet([at4km, ...customers(5)], { ...base, radiusKm: 1 });
    const at5 = buildCompSet([at4km, ...customers(5)], { ...base, radiusKm: 5 });
    expect(at1.records).toHaveLength(5);
    expect(at5.records).toHaveLength(6);
  });

  it('licença: unknown nunca entra; internal-only só no uso interno', () => {
    const unknown = externals(8).map((r) => ({ ...r, license: 'unknown' as const }));
    expect(buildCompSet(unknown, base).insufficient).toBe(true);
    expect(buildCompSet(unknown, base).excluded.unknownLicense).toBe(8);

    const internalOnly = externals(8).map((r) => ({ ...r, license: 'licensed_internal_only' as const }));
    const display = buildCompSet(internalOnly, base);
    expect(display.insufficient).toBe(true);
    expect(display.excluded.internalOnlyLicense).toBe(8);
    const internal = buildCompSet(internalOnly, { ...base, use: 'internal' });
    expect(internal.insufficient).toBe(false);
    expect(internal.records).toHaveLength(8);
  });

  it('dado externo velho demais (ou sem data de coleta) fica de fora; clientes não têm idade máxima', () => {
    const old = externals(8).map((r) => ({ ...r, collectedAt: '2024-01-01' }));
    const undated = externals(8, 'inside_airbnb').map((r) => ({ ...r, collectedAt: null }));
    expect(buildCompSet(old, base).excluded.stale).toBe(8);
    expect(buildCompSet(undated, base).excluded.stale).toBe(8);
    const oldCustomers = customers(5).map((r) => ({ ...r, collectedAt: '2020-01-01' }));
    expect(buildCompSet(oldCustomers, base).insufficient).toBe(false);
  });

  it('descarta registro sem diária', () => {
    const noAdr = customers(5).map((r) => ({ ...r, adr: null }));
    const result = buildCompSet(noAdr, base);
    expect(result.excluded.withoutAdr).toBe(5);
    expect(result.insufficient).toBe(true);
  });
});

describe('buildCompSet — privacidade (agregados e mínimos)', () => {
  it('clientes: conta ANFITRIÕES distintos; muitos imóveis do mesmo dono não bastam', () => {
    const sameOwner = Array.from({ length: 9 }, (_, i) => rec({ source: 'customers', sourceListingId: `s${i}`, ownerKey: 'dono-unico' }));
    const result = buildCompSet(sameOwner, base);
    expect(result.privacy.customers).toEqual({ distinct: 1, required: 5, qualified: false });
    expect(result.insufficient).toBe(true);
    expect(result.records).toEqual([]);
  });

  it('fontes externas: o mínimo é por ANÚNCIOS distintos (8 por padrão)', () => {
    expect(buildCompSet(externals(7), base).insufficient).toBe(true);
    const ok = buildCompSet(externals(8), base);
    expect(ok.insufficient).toBe(false);
    expect(ok.privacy.external).toEqual({ distinct: 8, required: 8, qualified: true });
  });

  it('o mesmo anúncio vindo de duas fontes externas conta uma vez para o mínimo', () => {
    // 8 anúncios licenciados + 8 cópias do Inside Airbnb dos MESMOS anúncios = 8 distintos, não 16
    const licensed = externals(8, 'licensed_dataset').map((r, i) => ({ ...r, dedupKey: `abnb:70${i}` }));
    const inside = externals(8, 'inside_airbnb').map((r, i) => ({ ...r, dedupKey: `abnb:70${i}` }));
    const result = buildCompSet([...licensed, ...inside], base);
    expect(result.duplicatesRemoved.byId).toBe(8);
    expect(result.privacy.external.distinct).toBe(8);

    const sevenPlusDuplicates = buildCompSet([...licensed.slice(0, 7), ...inside.slice(0, 7)], base);
    expect(sevenPlusDuplicates.privacy.external.distinct).toBe(7);
    expect(sevenPlusDuplicates.insufficient).toBe(true);
  });

  it('grupo abaixo do mínimo NÃO vaza para o agregado, mesmo que o outro grupo atinja o mínimo', () => {
    const threeHosts = customers(3);
    const result = buildCompSet([...threeHosts, ...externals(8)], base);
    expect(result.privacy.customers.qualified).toBe(false);
    expect(result.privacy.external.qualified).toBe(true);
    expect(result.records.every((r) => r.source !== 'customers')).toBe(true);
    expect(result.sources.map((s) => s.source)).toEqual(['licensed_dataset']);
  });

  it('os dois grupos qualificados somam, com resumo por fonte (origem, anúncios, coleta e licença)', () => {
    const result = buildCompSet([...customers(5), ...externals(8), ...externals(8, 'inside_airbnb')], base);
    expect(result.records).toHaveLength(21);
    expect(result.sources.map((s) => [s.source, s.listings])).toEqual([
      ['customers', 5],
      ['licensed_dataset', 8],
      ['inside_airbnb', 8],
    ]);
    const inside = result.sources.find((s) => s.source === 'inside_airbnb');
    expect(inside?.licenses).toEqual(['cc_by_4']);
    expect(inside?.latestCollectedAt).toBe('2026-10-20');
  });

  it('respeita mínimos configurados mais altos', () => {
    const strict = { ...base, config: { ...TEST_CONFIG, minHosts: 7, minExternalListings: 12 } };
    expect(buildCompSet(customers(6), strict).insufficient).toBe(true);
    expect(buildCompSet(customers(7), strict).insufficient).toBe(false);
    expect(buildCompSet(externals(11), strict).insufficient).toBe(true);
  });
});
