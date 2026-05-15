import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SugestionService } from './sugestion.service';
import { AnalisePreco } from '../entities/AnalisePreco';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';

describe('SugestionService', () => {
  let service: SugestionService;
  let repo: { findOne: jest.Mock; save: jest.Mock };
  let datasetCollector: { recordAppliedPrice: jest.Mock };

  const baseRegistro = () => ({
    id: 'rec-1',
    distanciaSuaPropriedade: 10.5,
    distanciaPropriedadeReferencia: 10.5,
    precoSugerido: '171.00',
    seuPrecoAtual: '150.00',
    diferencaPercentual: '14.00',
    recomendacao: 'Pode aumentar',
    aceito: false,
    status: 'suggested',
    aceitoEm: null,
    rejeitadoEm: null,
    expiradoEm: null,
    precoAplicado: null,
    aplicadoEm: null,
    origemAplicacao: null,
    reservaStatus: null,
    receitaReal: null,
    noitesReservadas: null,
    resultadoRegistradoEm: null,
    feedbackObservacao: null,
    motivo_ia: 'Mercado=150, evento=1.14x.',
    criadoEm: new Date('2026-05-15T14:00:00.000Z'),
    usuarioProprietario: {
      id: 'user-1',
      email: 'host@example.com',
      password: 'hashed-secret',
      role: 'admin',
    },
    endereco: {
      id: 'addr-1',
      cep: '00000-000',
      list: {
        id: 'list-1',
        titulo: 'Apartamento em Perdizes',
        id_do_anuncio: '1624962729109862074',
        manualDailyPrice: 150,
        averageMonthlyRevenue: 4500,
      },
    },
    evento: {
      id: 'event-1',
      nome: 'Brasil Brau 2026',
      cidade: 'Sao Paulo',
      estado: 'SP',
      dataInicio: new Date('2026-06-09T13:00:00.000Z'),
      source: 'firecrawl',
      relevancia: 65,
    },
  }) as any as AnalisePreco;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    datasetCollector = { recordAppliedPrice: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SugestionService,
        { provide: getRepositoryToken(AnalisePreco), useValue: repo },
        { provide: DatasetCollectorService, useValue: datasetCollector },
      ],
    }).compile();

    service = module.get(SugestionService);
  });

  it('returns a sanitized DTO when accepting a suggestion', async () => {
    repo.findOne.mockResolvedValue(baseRegistro());

    const result = await service.alterarAceito('rec-1', 'user-1', true);

    expect(result).toMatchObject({
      id: 'rec-1',
      property: { addressId: 'addr-1', listId: 'list-1' },
      event: { id: 'event-1', name: 'Brasil Brau 2026' },
      lifecycle: { accepted: true, status: 'accepted' },
    });
    expect(JSON.stringify(result)).not.toContain('hashed-secret');
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('usuarioProprietario');
  });

  it('records applied price and still returns a sanitized DTO', async () => {
    repo.findOne.mockResolvedValue(baseRegistro());

    const result = await service.registrarPrecoAplicado('rec-1', 'user-1', {
      precoAplicado: 171,
      origem: 'manual_dashboard',
      reservaStatus: 'unknown',
      receitaReal: null,
      noitesReservadas: null,
      feedbackObservacao: 'Smoke controlado',
    });

    expect(result.lifecycle).toMatchObject({
      accepted: true,
      status: 'applied_manual',
      appliedPrice: 171,
      applicationOrigin: 'manual_dashboard',
    });
    expect(result.outcome).toMatchObject({
      reservationStatus: 'unknown',
      note: 'Smoke controlado',
    });
    expect(datasetCollector.recordAppliedPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: '1624962729109862074',
        appliedPriceCents: 17100,
        listInternalId: 'list-1',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('hashed-secret');
  });
});
