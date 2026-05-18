jest.mock('p-limit', () => () => (fn: () => unknown) => fn());
jest.mock('../knn-engine/pricing-engine', () => ({ UrbanAIPricingEngine: class {} }));

import { PropriedadeService } from './propriedade.service';

describe('PropriedadeService public responses', () => {
  const makeService = (overrides: Record<string, any> = {}) => {
    const deps = {
      addressRepository: {},
      propriedades: {},
      pricingCalculateService: {},
      analiseEnderecoEventoRepository: {},
      userRepository: {},
      eventoRepository: {},
      analisePrecoRepository: {},
      pricingInputHistoryRepository: {},
      airbnbService: {},
      emailService: {},
      aiEngine: {},
      datasetCollector: {},
      ...overrides,
    };

    return new PropriedadeService(
      deps.addressRepository as any,
      deps.propriedades as any,
      deps.pricingCalculateService as any,
      deps.analiseEnderecoEventoRepository as any,
      deps.userRepository as any,
      deps.eventoRepository as any,
      deps.analisePrecoRepository as any,
      deps.pricingInputHistoryRepository as any,
      deps.airbnbService as any,
      deps.emailService as any,
      deps.aiEngine as any,
      deps.datasetCollector as any,
    );
  };

  it('does not leak nested user entities when listing host properties', async () => {
    const addressRepository = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'addr-1',
            cep: '00000-000',
            numero: 'S/N',
            logradouro: null,
            bairro: 'Perdizes',
            cidade: 'Sao Paulo',
            estado: 'SP',
            latitude: '-23.53440000',
            longitude: '-46.67560000',
            ativo: true,
            created_at: new Date('2026-05-15T14:00:00.000Z'),
            updated_at: new Date('2026-05-15T14:00:00.000Z'),
            analisado: 'completed',
            idAlertAirb: 'scraping_direct',
            user: { id: 'user-1', email: 'host@example.com', password: 'hashed-secret' },
            list: {
              id: 'list-1',
              titulo: 'Apartamento em Perdizes',
              id_do_anuncio: '1606677209576351969',
              pictureUrl: 'https://example.com/photo.jpg',
              ativo: true,
              user: { id: 'user-1', email: 'host@example.com', password: 'nested-secret' },
              manualDailyPrice: 150,
              averageMonthlyRevenue: 4500,
              dailyPrice: 150,
              pricingInputSource: 'manual',
            },
          },
        ],
        1,
      ]),
    };
    const service = makeService({ addressRepository });

    const result = await service.findByUserId('user-1', 1, 10);

    expect(result.data[0]).toMatchObject({
      id: 'addr-1',
      userId: 'user-1',
      list: {
        id: 'list-1',
        userId: 'user-1',
        manualDailyPrice: 150,
        averageMonthlyRevenue: 4500,
      },
    });
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('hashed-secret');
    expect(JSON.stringify(result)).not.toContain('nested-secret');
    expect(JSON.stringify(result)).not.toContain('host@example.com');
  });

  it('counts one pricing suggestion per event even when proximity rows exist per transport mode', async () => {
    const futureEvent = {
      id: 'event-1',
      nome: 'Show',
      dataInicio: new Date(Date.now() + 86_400_000).toISOString(),
      latitude: -23.5,
      longitude: -46.6,
    };
    const address = {
      id: 'addr-1',
      idAlertAirb: 'alert-1',
      latitude: -23.51,
      longitude: -46.61,
      user: { id: 'user-1' },
      list: { id: 'list-1' },
    };
    const propriedades = {
      findOne: jest.fn().mockResolvedValue({ id: 'list-1', titulo: 'Apartamento em Perdizes' }),
    };
    const analiseEnderecoEventoRepository = {
      find: jest.fn().mockResolvedValue([
        { evento: futureEvent, transportMode: 'car' },
        { evento: futureEvent, transportMode: 'bus' },
        { evento: futureEvent, transportMode: 'pedestrian' },
      ]),
    };
    const emailService = {
      enviarNotification: jest.fn().mockResolvedValue({ enviado: true }),
    };
    const service = makeService({
      addressRepository: { findOne: jest.fn().mockResolvedValue(address) },
      propriedades,
      analiseEnderecoEventoRepository,
      airbnbService: { getFirstAvailablePrice: jest.fn().mockResolvedValue({}) },
      emailService,
    });

    jest.spyOn(service as any, 'getPricingBaseQuote').mockResolvedValue({
      price: { status: true },
      propertyDetails: {},
    });
    jest.spyOn(service as any, 'buscarAlertPorId').mockResolvedValue({
      comps: [{ similarity_score: 0.9, listingID: 'ref-1' }],
    });
    const pricingSpy = jest
      .spyOn(service as any, 'getPricingPropriedadeByEventAndByProperty')
      .mockResolvedValue({ ok: true, updated: false });
    jest.spyOn(service as any, 'compilarEventosFuturosPorUsuario').mockResolvedValue(null);

    const result = await service.buscarAddress('list-1');

    expect(pricingSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      pricingGenerated: 1,
      pricingCreated: 1,
      pricingUpdated: 0,
      pricingDuplicateTransportRows: 2,
      pricingCandidates: 1,
    });
    expect(emailService.enviarNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Sugestoes de preco disponiveis',
        description: 'Geramos 1 sugestao de preco para a propriedade Apartamento em Perdizes.',
      }),
    );
  });

  it('does not notify again when all deduped pricing suggestions are unchanged', async () => {
    const futureEvent = {
      id: 'event-1',
      nome: 'Show',
      dataInicio: new Date(Date.now() + 86_400_000).toISOString(),
      latitude: -23.5,
      longitude: -46.6,
    };
    const emailService = {
      enviarNotification: jest.fn().mockResolvedValue({ enviado: true }),
    };
    const service = makeService({
      addressRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'addr-1',
          idAlertAirb: 'alert-1',
          user: { id: 'user-1' },
          list: { id: 'list-1' },
        }),
      },
      propriedades: {
        findOne: jest.fn().mockResolvedValue({ id: 'list-1', titulo: 'Apartamento em Perdizes' }),
      },
      analiseEnderecoEventoRepository: {
        find: jest.fn().mockResolvedValue([{ evento: futureEvent, transportMode: 'car' }]),
      },
      airbnbService: { getFirstAvailablePrice: jest.fn().mockResolvedValue({}) },
      emailService,
    });

    jest.spyOn(service as any, 'getPricingBaseQuote').mockResolvedValue({
      price: { status: true },
      propertyDetails: {},
    });
    jest.spyOn(service as any, 'buscarAlertPorId').mockResolvedValue({
      comps: [{ similarity_score: 0.9, listingID: 'ref-1' }],
    });
    jest
      .spyOn(service as any, 'getPricingPropriedadeByEventAndByProperty')
      .mockResolvedValue({ ok: true, unchanged: true });
    jest.spyOn(service as any, 'compilarEventosFuturosPorUsuario').mockResolvedValue(null);

    const result = await service.buscarAddress('list-1');

    expect(result).toMatchObject({
      pricingGenerated: 0,
      pricingUnchanged: 1,
    });
    expect(emailService.enviarNotification).not.toHaveBeenCalled();
  });
});
