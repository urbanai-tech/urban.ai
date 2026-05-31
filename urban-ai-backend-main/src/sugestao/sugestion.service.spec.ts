jest.mock('src/airbnb/airbnb.service', () => ({
  AirbnbService: class AirbnbService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SugestionService } from './sugestion.service';
import { AnalisePreco } from '../entities/AnalisePreco';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { PriceUpdate } from '../entities/price-update.entity';
import { AirbnbService } from 'src/airbnb/airbnb.service';

describe('SugestionService', () => {
  let service: SugestionService;
  let repo: { findOne: jest.Mock; save: jest.Mock };
  let datasetCollector: { recordAppliedPrice: jest.Mock };
  let priceUpdateRepo: { findOne: jest.Mock };
  let airbnbService: { getPriceForDateWindow: jest.Mock };

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
    verificationStatus: null,
    verificationCheckedAt: null,
    verifiedAppliedAt: null,
    observedPrice: null,
    verificationSource: null,
    verificationError: null,
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
    priceUpdateRepo = { findOne: jest.fn() };
    airbnbService = { getPriceForDateWindow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SugestionService,
        { provide: getRepositoryToken(AnalisePreco), useValue: repo },
        { provide: DatasetCollectorService, useValue: datasetCollector },
        { provide: getRepositoryToken(PriceUpdate), useValue: priceUpdateRepo },
        { provide: AirbnbService, useValue: airbnbService },
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
      verification: { status: 'pending' },
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
    expect(result.verification).toMatchObject({
      status: 'pending',
      observedPrice: null,
      source: null,
      error: null,
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

  it('bloqueia preço aplicado quando a sugestão está incompleta', async () => {
    const registro = baseRegistro();
    registro.endereco.list = null as any;
    repo.findOne.mockResolvedValue(registro);

    await expect(service.registrarPrecoAplicado('rec-1', 'user-1', {
      precoAplicado: 171,
      origem: 'manual_dashboard',
    })).rejects.toThrow('Sugestão sem imóvel associado não pode ser aceita');
    expect(repo.save).not.toHaveBeenCalled();
    expect(datasetCollector.recordAppliedPrice).not.toHaveBeenCalled();
  });

  it('bloqueia aceite de sugestão sem listing Airbnb associado', async () => {
    const registro = baseRegistro();
    registro.endereco.list = null as any;
    repo.findOne.mockResolvedValue(registro);

    await expect(service.alterarAceito('rec-1', 'user-1', true)).rejects.toThrow(
      'Sugestão sem imóvel associado não pode ser aceita',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('permite rejeitar sugestão incompleta para limpar o estado do usuário', async () => {
    const registro = baseRegistro();
    registro.endereco.list = null as any;
    repo.findOne.mockResolvedValue(registro);

    const result = await service.alterarAceito('rec-1', 'user-1', false);

    expect(result.lifecycle).toMatchObject({
      accepted: false,
      status: 'rejected',
    });
    expect(repo.save).toHaveBeenCalled();
  });

  it('verifica aplicacao usando PriceUpdate Stays confirmado como fonte preferencial', async () => {
    const registro = baseRegistro();
    registro.aceito = true;
    registro.status = 'applied_stays';
    registro.precoAplicado = 171;
    registro.aplicadoEm = new Date('2026-05-20T10:00:00.000Z');
    repo.findOne.mockResolvedValue(registro);
    priceUpdateRepo.findOne.mockResolvedValue({
      id: 'pu-1',
      status: 'success',
      newPriceCents: 17100,
      createdAt: new Date('2026-05-20T10:05:00.000Z'),
    });

    const result = await service.verificarAplicacao('rec-1');

    expect(result.verification).toMatchObject({
      status: 'verified',
      observedPrice: 171,
      source: 'stays_price_update',
      error: null,
    });
    expect(airbnbService.getPriceForDateWindow).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      verificationStatus: 'verified',
      observedPrice: 171,
      verificationSource: 'stays_price_update',
    }));
  });

  it('marca mismatch quando o Airbnb observa preço diferente do aplicado', async () => {
    const registro = baseRegistro();
    registro.aceito = true;
    registro.status = 'applied_manual';
    registro.precoAplicado = 171;
    repo.findOne.mockResolvedValue(registro);
    priceUpdateRepo.findOne.mockResolvedValue(null);
    airbnbService.getPriceForDateWindow.mockResolvedValue({
      price: { data: { accommodationCost: 189 } },
      nights: 1,
      source: 'airbnb-browser',
    });

    const result = await service.verificarAplicacao('rec-1');

    expect(result.verification).toMatchObject({
      status: 'mismatch',
      observedPrice: 189,
      source: 'airbnb-browser',
    });
    expect(result.verification.error).toContain('Preço observado 189.00');
  });

  it('mantém aceita sem aplicação como pendente de verificação', async () => {
    const registro = baseRegistro();
    registro.aceito = true;
    registro.status = 'accepted';
    repo.findOne.mockResolvedValue(registro);

    const result = await service.verificarAplicacao('rec-1');

    expect(result.verification).toMatchObject({
      status: 'pending',
      error: 'Sugestão aceita sem preço aplicado registrado.',
    });
    expect(priceUpdateRepo.findOne).not.toHaveBeenCalled();
    expect(airbnbService.getPriceForDateWindow).not.toHaveBeenCalled();
  });
});
