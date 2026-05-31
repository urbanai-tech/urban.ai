jest.mock('src/airbnb/airbnb.service', () => ({
  AirbnbService: class AirbnbService { },
}));
jest.mock('src/email/email.service', () => ({
  EmailService: class EmailService { },
}));
jest.mock('src/mailer/mailer.service', () => ({
  MailerService: class MailerService { },
}));
jest.mock('src/propriedades/propriedade.service', () => ({
  PropriedadeService: class PropriedadeService { },
}));

import { Logger } from '@nestjs/common';
import { CronService } from './cron.service';

describe('CronService', () => {
  const makeService = (analises: any[]) => {
    const analisePrecoRepository = {
      find: jest.fn().mockResolvedValue(analises),
    };
    const airbnbService = {
      getFirstAvailablePrice: jest.fn(),
    };
    const emailService = {
      enviarNotification: jest.fn().mockResolvedValue({ enviado: true }),
    };
    const mailerSender = {
      sendTextEmailCron: jest.fn(),
    };
    const propriedadeService = {
      refreshAllPropertyMetadata: jest.fn(),
    };

    const service = new CronService(
      analisePrecoRepository as any,
      airbnbService as any,
      emailService as any,
      mailerSender as any,
      propriedadeService as any,
    );

    jest.spyOn(service as any, 'waitBetweenCronItems').mockResolvedValue(undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    return {
      service,
      analisePrecoRepository,
      airbnbService,
      emailService,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ignora análise aceita sem endereço/listing sem derrubar o cron', async () => {
    const { service, airbnbService, emailService } = makeService([
      {
        id: 'analysis-missing-address',
        endereco: null,
        usuarioProprietario: { id: 'user-1' },
        diferencaPercentual: 20,
        precoSugerido: 150,
      },
    ]);

    const result = await service.buscarAnalisesAceitas();

    expect(result).toEqual({
      iniciado: true,
      total: 1,
      processed: 0,
      skipped: 1,
      failed: 0,
      failures: [],
    });
    expect(airbnbService.getFirstAvailablePrice).not.toHaveBeenCalled();
    expect(emailService.enviarNotification).not.toHaveBeenCalled();
  });

  it('processa uma análise válida usando o id do anúncio do endereço', async () => {
    const { service, analisePrecoRepository, airbnbService, emailService } = makeService([
      {
        id: 'analysis-valid',
        endereco: {
          id: 'address-1',
          cep: '05001-000',
          logradouro: 'Rua Turiassu',
          numero: '100',
          bairro: 'Perdizes',
          cidade: 'Sao Paulo',
          estado: 'SP',
          list: {
            id: 'list-1',
            id_do_anuncio: 'airbnb-123',
            titulo: 'Apartamento em Perdizes',
            internalNickname: 'Perdizes 1',
            internalCode: 'PER-01',
          },
        },
        evento: {
          nome: 'Show no Allianz',
          dataInicio: new Date('2026-06-10T20:00:00.000Z'),
          cidade: 'Sao Paulo',
          estado: 'SP',
          relevancia: 92,
          expectedAttendance: 43000,
        },
        usuarioProprietario: { id: 'user-1' },
        distanciaSuaPropriedade: 1.4,
        recomendacao: 'Aumentar diária pela demanda do evento.',
        diferencaPercentual: 20,
        precoSugerido: 150,
      },
    ]);
    airbnbService.getFirstAvailablePrice.mockResolvedValue({
      price: {
        data: {
          accommodationCost: 100,
          accommodationCostTitle: '1 night x R$100',
        },
      },
    });

    const result = await service.buscarAnalisesAceitas();

    expect(analisePrecoRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: ['endereco', 'endereco.list', 'evento', 'usuarioProprietario'],
      }),
    );
    expect(airbnbService.getFirstAvailablePrice).toHaveBeenCalledWith('airbnb-123');
    expect(emailService.enviarNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        redirectTo: '/dashboard?propertyId=address-1&source=cron_pricing_digest',
        sendEmail: true,
        sendPush: true,
        pushType: 'pricing_recommendation',
        pushTag: 'pricing-recommendation-address-1',
        metadata: expect.objectContaining({
          propertyTitle: 'Apartamento em Perdizes',
          propertyNickname: 'Perdizes 1',
          propertyCode: 'PER-01',
          propertyAddress: 'Rua Turiassu, 100, Perdizes, Sao Paulo - SP, CEP 05001-000',
          currentPrice: 100,
          suggestedPrice: 150,
          liftPercent: 20,
          eventName: 'Show no Allianz',
          distanceKm: 1.4,
          expectedAttendance: 43000,
          relevance: 92,
          reasons: expect.arrayContaining([
            'Evento analisado: Show no Allianz.',
            'Distância do imóvel: 1,4 km.',
          ]),
        }),
      }),
    );
    expect(result).toEqual({
      iniciado: true,
      total: 1,
      processed: 1,
      skipped: 0,
      failed: 0,
      failures: [],
    });
  });

  it('envia recomendação de diminuir preço pelo digest de pricing', async () => {
    const { service, airbnbService, emailService } = makeService([
      {
        id: 'analysis-decrease',
        endereco: {
          id: 'address-1',
          list: { id: 'list-2', id_do_anuncio: 'airbnb-456', titulo: 'Studio Paulista' },
        },
        evento: {
          nome: 'Feira de bairro',
          dataInicio: new Date('2026-06-11T12:00:00.000Z'),
          enderecoCompleto: 'Expo Center Norte',
          capacidadeEstimada: 3000,
        },
        usuarioProprietario: { id: 'user-1' },
        distanciaSuaPropriedade: 4.2,
        recomendacao: 'Reduzir para ocupar datas com demanda menor.',
        diferencaPercentual: -12,
        precoSugerido: 220,
      },
    ]);
    airbnbService.getFirstAvailablePrice.mockResolvedValue({
      price: {
        data: {
          accommodationCost: 250,
          accommodationCostTitle: '1 night x R$250',
        },
      },
    });

    const result = await service.buscarAnalisesAceitas();

    expect(emailService.enviarNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Sugestão de preço para ganhar competitividade',
        redirectTo: '/dashboard?propertyId=address-1&source=cron_pricing_digest',
        sendEmail: true,
        sendPush: true,
        pushType: 'pricing_recommendation',
        metadata: expect.objectContaining({
          propertyTitle: 'Studio Paulista',
          currentPrice: 250,
          suggestedPrice: 220,
          liftPercent: -12,
          expectedAttendance: 3000,
          reasons: expect.arrayContaining([
            'Evento analisado: Feira de bairro.',
            'Distância do imóvel: 4,2 km.',
          ]),
        }),
      }),
    );
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('continua processando proximas analises quando o Airbnb falha em uma delas', async () => {
    const { service, airbnbService, emailService } = makeService([
      {
        id: 'analysis-airbnb-failure',
        endereco: {
          id: 'address-1',
          list: { id_do_anuncio: 'airbnb-fails' },
        },
        usuarioProprietario: { id: 'user-1' },
        diferencaPercentual: 20,
        precoSugerido: 150,
      },
      {
        id: 'analysis-valid-next',
        endereco: {
          id: 'address-2',
          list: { id_do_anuncio: 'airbnb-next' },
        },
        usuarioProprietario: { id: 'user-2' },
        diferencaPercentual: 0,
        precoSugerido: 100,
      },
    ]);
    airbnbService.getFirstAvailablePrice
      .mockRejectedValueOnce(new Error('Airbnb indisponível'))
      .mockResolvedValueOnce({
        price: {
          data: {
            accommodationCost: 100,
            accommodationCostTitle: '1 night x R$100',
          },
        },
      });

    const result = await service.buscarAnalisesAceitas();

    expect(airbnbService.getFirstAvailablePrice).toHaveBeenCalledTimes(2);
    expect(emailService.enviarNotification).not.toHaveBeenCalled();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      {
        analiseId: 'analysis-airbnb-failure',
        reason: 'Airbnb indisponível',
      },
    ]);
  });
});
