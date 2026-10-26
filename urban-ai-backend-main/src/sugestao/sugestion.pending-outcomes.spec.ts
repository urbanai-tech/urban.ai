jest.mock('src/airbnb/airbnb.service', () => ({
  AirbnbService: class AirbnbService {},
}));

import { SugestionService } from './sugestion.service';

describe('SugestionService.listarResultadosPendentes (V4)', () => {
  const NOW = new Date('2026-10-26T15:00:00Z'); // segunda 12:00 BRT
  const build = (rows: any[]) => {
    const repo = { find: jest.fn().mockResolvedValue(rows) };
    const service = new SugestionService(repo as any, {} as any);
    return { service, repo };
  };
  const row = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    aplicadoEm: new Date('2026-10-20T12:00:00Z'),
    precoAplicado: '300.00',
    precoSugerido: '320.00',
    seuPrecoAtual: '250.00',
    resultadoRegistradoEm: null,
    reservaStatus: null,
    receitaReal: null,
    noitesReservadas: null,
    aceito: true,
    status: 'applied_manual',
    evento: { id: `ev-${id}`, nome: 'Show', dataInicio: new Date('2026-10-24T22:00:00Z'), dataFim: new Date('2026-10-25T02:00:00Z') },
    endereco: { id: 'addr-1', list: { titulo: 'Studio Paulista' } },
    ...overrides,
  });

  it('consulta só o dono, aplicadas sem resultado, com evento anterior a hoje (SP)', async () => {
    const { service, repo } = build([]);
    await service.listarResultadosPendentes('user-1', NOW);
    const query = repo.find.mock.calls[0][0];
    expect(query.where.usuarioProprietario).toEqual({ id: 'user-1' });
    expect(query.where.aplicadoEm).toBeDefined();
    expect(query.where.resultadoRegistradoEm).toBeDefined();
    // início de "hoje" em São Paulo = 03:00Z
    expect(query.where.evento.dataInicio.value.toISOString()).toBe('2026-10-26T03:00:00.000Z');
  });

  it('devolve o formato do EventCard (idAnalise, preços, imóvel) para registrar o resultado', async () => {
    const { service } = build([row('a')]);
    const result = await service.listarResultadosPendentes('user-1', NOW);
    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      idAnalise: 'a',
      nome: 'Show',
      propertyId: 'addr-1',
      propertyTitle: 'Studio Paulista',
      precoAplicado: '300.00',
      precoSugerido: '320.00',
      status: 'applied_manual',
    });
  });

  it('descarta quem já respondeu algo concreto e evento de hoje (ainda não passou no dia de SP)', async () => {
    const { service } = build([
      row('pending'),
      row('answered', { resultadoRegistradoEm: new Date(), reservaStatus: 'booked' }),
      row('today', { evento: { id: 'ev-t', nome: 'Hoje', dataInicio: new Date('2026-10-27T00:30:00Z') } }), // 21:30 BRT de hoje... é 26/10 em SP
    ]);
    const result = await service.listarResultadosPendentes('user-1', NOW);
    expect(result.data.map((item: any) => item.idAnalise)).toEqual(['pending']);
  });
});
