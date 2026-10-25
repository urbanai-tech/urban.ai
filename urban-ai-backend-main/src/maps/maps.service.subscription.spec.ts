import { entitlementDouble } from 'src/subscription/entitlement.testing';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (handler: () => unknown) => handler(),
}));

jest.mock('src/util', () => ({
  aproximadamenteOuMenor: jest.fn(() => true),
  calculateDistance: jest.fn().mockResolvedValue(1),
  calculateDistanceHere: jest.fn().mockResolvedValue({ length: 1000, baseDuration: 600 }),
}));

jest.mock('src/propriedades/propriedade.service', () => ({ PropriedadeService: class PropriedadeService {} }));
jest.mock('src/process/process.service', () => ({ ProcessService: class ProcessService {} }));
jest.mock('src/email/email.service', () => ({ EmailService: class EmailService {} }));

import { MapsService } from './maps.service';

/**
 * Processar análises gasta API paga (HERE/RapidAPI/scraping): só roda para quem tem
 * direito de uso, e nunca para imóvel pausado (ativo=false) — as queries de endereço
 * continuam filtrando `ativo: true`.
 */
describe('MapsService + assinatura', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  function build(entitled: boolean | ((userId: string) => boolean)) {
    const eventQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const eventRepo = { createQueryBuilder: jest.fn(() => eventQuery) };
    const addressRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };
    const userRepo = { find: jest.fn() };
    const analysisRepo = { find: jest.fn().mockResolvedValue([]), create: jest.fn(), save: jest.fn() };
    const processService = {
      tryMarkRunning: jest.fn().mockResolvedValue({ started: true }),
      updateStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
    };
    const propriedadeService = { buscarAddress: jest.fn().mockResolvedValue(undefined) };
    const service = new MapsService(
      eventRepo as any,
      addressRepo as any,
      userRepo as any,
      analysisRepo as any,
      processService as any,
      {} as any,
      propriedadeService as any,
      entitlementDouble({ entitled }) as any,
    );
    return { service, eventRepo, addressRepo, userRepo, propriedadeService, processService };
  }

  it('processarAnalisesByProperty não faz nada (nem geocodifica, nem marca running) sem assinatura', async () => {
    const { service, addressRepo, eventRepo, propriedadeService } = build(false);
    const update = jest.fn();
    addressRepo.createQueryBuilder.mockReturnValue({ update });

    const result = await service.processarAnalisesByProperty('user-gratis', 'list-1');

    expect(result).toEqual({ ok: true, skipped: 'subscription_required' });
    expect(addressRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(addressRepo.find).not.toHaveBeenCalled();
    expect(eventRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(propriedadeService.buscarAddress).not.toHaveBeenCalled();
  });

  it('processarAnalisesByProperty segue o fluxo normal com assinatura e só lê endereços ativos', async () => {
    const { service, addressRepo, userRepo } = build(true);
    userRepo.find.mockResolvedValue([]);
    const chain: any = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) };
    addressRepo.createQueryBuilder.mockReturnValue(chain);

    const result = await service.processarAnalisesByProperty('user-pagante', 'list-1');

    expect((result as any).skipped).toBeUndefined();
    const addressQueries = addressRepo.find.mock.calls.map((call) => call[0]?.where);
    // a consulta que alimenta as análises exclui imóveis pausados/inativos
    expect(addressQueries.some((where) => where?.ativo === true && where?.list?.id === 'list-1')).toBe(true);
  });

  it('processamento global só considera usuários com direito de uso', async () => {
    const { service, userRepo, addressRepo } = build((userId) => userId === 'user-pagante');
    userRepo.find.mockResolvedValue([
      { id: 'user-pagante', distanceKm: 5 },
      { id: 'user-gratis', distanceKm: 5 },
    ]);

    await service.processarAnalisesTodosUsuarios();

    const queriedUsers = addressRepo.find.mock.calls.map((call) => call[0].where.user.id);
    expect(queriedUsers).toEqual(['user-pagante']);
    expect(addressRepo.find.mock.calls[0][0].where.ativo).toBe(true);
  });
});
