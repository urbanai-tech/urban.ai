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

describe('MapsService cron idempotency', () => {
  it('skips an existing address-event-transport analysis during global processing', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const user = { id: 'user-1', distanceKm: 5 };
    const address = { id: 'address-1', latitude: -23.5, longitude: -46.6 };
    const event = { id: 'event-1', latitude: -23.51, longitude: -46.61, raioImpactoKm: 5 };
    const eventQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([event]),
    };
    const eventRepo = { createQueryBuilder: jest.fn(() => eventQuery) };
    const addressRepo = { find: jest.fn().mockResolvedValue([address]) };
    const userRepo = { find: jest.fn().mockResolvedValue([user]) };
    const analysisRepo = {
      find: jest.fn().mockResolvedValue([
        { endereco: address, evento: event, transportMode: 'car' },
        { endereco: address, evento: event, transportMode: 'bus' },
        { endereco: address, evento: event, transportMode: 'pedestrian' },
      ]),
      create: jest.fn(),
      save: jest.fn(),
    };
    const processService = {
      tryMarkRunning: jest.fn().mockResolvedValue({ started: true }),
      updateStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
    };
    const service = new MapsService(
      eventRepo as any,
      addressRepo as any,
      userRepo as any,
      analysisRepo as any,
      processService as any,
      {} as any,
      {} as any,
    );

    await expect(service.processarAnalisesTodosUsuarios()).resolves.toEqual({ ok: true });
    expect(analysisRepo.find).toHaveBeenCalledWith(expect.objectContaining({ relations: ['evento', 'endereco'] }));
    expect(analysisRepo.create).not.toHaveBeenCalled();
    expect(analysisRepo.save).not.toHaveBeenCalled();
    expect(processService.updateStatus).toHaveBeenCalledWith('completed');
  });
});
