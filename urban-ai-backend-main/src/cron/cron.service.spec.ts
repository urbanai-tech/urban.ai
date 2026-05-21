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

  it('ignora analise aceita sem endereco/listing sem derrubar o cron', async () => {
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

  it('processa uma analise valida usando o id do anuncio do endereco', async () => {
    const { service, analisePrecoRepository, airbnbService, emailService } = makeService([
      {
        id: 'analysis-valid',
        endereco: {
          id: 'address-1',
          list: { id_do_anuncio: 'airbnb-123' },
        },
        usuarioProprietario: { id: 'user-1' },
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
        redirectTo: '/painel',
        sendEmail: true,
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
      .mockRejectedValueOnce(new Error('Airbnb indisponivel'))
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
        reason: 'Airbnb indisponivel',
      },
    ]);
  });
});
