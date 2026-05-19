jest.mock('p-limit', () => () => (fn: () => unknown) => fn());
jest.mock('../knn-engine/pricing-engine', () => ({ UrbanAIPricingEngine: class {} }));

import { PropriedadeService } from './propriedade.service';
import { PricingGuardrailService } from './pricing-guardrail.service';

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
      mailerService: {},
      aiEngine: {},
      datasetCollector: {},
      pricingGuardrailService: new PricingGuardrailService(),
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
      deps.mailerService as any,
      deps.aiEngine as any,
      deps.datasetCollector as any,
      deps.pricingGuardrailService as any,
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

  it('applies user pricing guardrails to math and final AI suggestions', async () => {
    const pricingCalculateService = {
      calcular: jest.fn().mockReturnValue({
        precoSugerido: 120,
        seuPrecoAtual: 100,
        diferencaPercentual: 20,
        recomendacao: 'Pode aumentar',
        motivo: 'math guardrail',
      }),
    };
    const save = jest.fn().mockImplementation(async (payload) => ({ id: 'analysis-1', ...payload }));
    const service = makeService({
      pricingCalculateService,
      eventoRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'event-1',
          nome: 'Mega Show',
          latitude: -23.5,
          longitude: -46.6,
          relevancia: 90,
        }),
      },
      propriedades: {
        findOne: jest.fn().mockResolvedValue({
          id: 'list-1',
          user: {
            id: 'user-1',
            pricingStrategy: 'moderate',
            percentualInicial: -10,
            percentualFinal: 20,
          },
        }),
      },
      addressRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'addr-1',
          latitude: -23.51,
          longitude: -46.61,
        }),
      },
      analisePrecoRepository: {
        findOne: jest.fn().mockResolvedValue(null),
        save,
      },
      aiEngine: {
        initialize: jest.fn(),
        suggestPrice: jest.fn().mockResolvedValue({
          suggestedPrice: 180,
          increasePercentage: 80,
          details: { reasoning: 'knn suggested a larger move' },
        }),
      },
      datasetCollector: {
        recordCompsFromAnalysis: jest.fn().mockResolvedValue(undefined),
      },
    });

    const result = await service.getPricingPropriedadeByEventAndByProperty(
      'alert-1',
      'list-1',
      'event-1',
      {
        price: { data: { accommodationCost: 100, accommodationCostTitle: '1 night' } },
        propertyDetails: { bedrooms: 1, bathrooms: 1 },
      } as any,
      {
        price: { data: { accommodationCost: 500, accommodationCostTitle: '1 night' } },
      } as any,
      {
        comps: [
          {
            listingID: 'comp-1',
            latitude: -23.52,
            longitude: -46.62,
            bedrooms: 1,
            bathrooms: 1,
            avg_booked_daily_rate_ltm: 500,
            similarity_score: 0.95,
          },
        ],
      } as any,
    );

    expect(pricingCalculateService.calcular).toHaveBeenCalledWith(
      expect.objectContaining({
        maxReducaoPercent: 10,
        maxAumentoPercent: 20,
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      precoSugerido: 120,
      diferencaPercentual: 20,
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        precoSugerido: 120,
        diferencaPercentual: 20,
        motivo_ia: expect.stringContaining('perfil moderado (-10%/+20%)'),
      }),
    );
  });
});
