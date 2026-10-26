import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HostBaselineService } from './host-baseline.service';

describe('HostBaselineService (plano B do scraping)', () => {
  const makeList = (overrides: Record<string, unknown> = {}) => ({
    id: 'list-1',
    manualDailyPrice: null,
    averageMonthlyRevenue: 5000,
    pricingInputSource: null,
    quartos: 1,
    camas: 1,
    ...overrides,
  });

  const makeService = (address: any) => {
    const addressRepository = {
      findOne: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(address && where.user.id === address.user.id && where.id === address.id ? address : null),
      ),
    };
    const listRepository = { save: jest.fn().mockImplementation((list: any) => Promise.resolve(list)) };
    const historyRepository = {
      create: jest.fn().mockImplementation((value: any) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new HostBaselineService(
      addressRepository as any,
      listRepository as any,
      historyRepository as any,
    );
    return { service, addressRepository, listRepository, historyRepository };
  };

  const makeAddress = (listOverrides: Record<string, unknown> = {}) => ({
    id: 'addr-1',
    user: { id: 'user-1' },
    list: makeList(listOverrides),
  });

  it('grava a diária do anfitrião com marcador host_input, data e histórico', async () => {
    const { service, listRepository, historyRepository } = makeService(makeAddress());

    const result = await service.saveHostInput('addr-1', 'user-1', {
      manualDailyPrice: 380,
      minDailyPrice: 250,
      weekendDailyPrice: 450,
    });

    const saved = listRepository.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      manualDailyPrice: 380,
      minDailyPrice: 250,
      weekendDailyPrice: 450,
      pricingInputSource: 'host_input',
      dailyPrice: 380,
    });
    expect(saved.hostInputUpdatedAt).toBeInstanceOf(Date);
    // Sem essenciais informados, a origem dos essenciais não muda.
    expect(saved.essentialsSource).toBeUndefined();
    expect(historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'host_input', newManualDailyPrice: 380, previousManualDailyPrice: null }),
    );
    expect(result).toMatchObject({
      addressId: 'addr-1',
      dailyPrice: 380,
      source: 'host_input',
      stale: false,
      minDailyPrice: 250,
      weekendDailyPrice: 450,
    });
  });

  it('marca os essenciais como host_input só quando algum veio, preservando os omitidos', async () => {
    const { service, listRepository } = makeService(makeAddress({ quartos: 1, camas: 2 }));

    await service.saveHostInput('addr-1', 'user-1', {
      manualDailyPrice: 300,
      quartos: 3,
      banheiros: 2,
      propertyType: '  Apartamento ',
    });

    const saved = listRepository.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      quartos: 3,
      camas: 2,
      banheiros: 2,
      propertyType: 'Apartamento',
      essentialsSource: 'host_input',
    });
    expect(saved.essentialsUpdatedAt).toBeInstanceOf(Date);
  });

  it('recusa a diária mínima maior que a base', async () => {
    const { service, listRepository } = makeService(makeAddress());
    await expect(
      service.saveHostInput('addr-1', 'user-1', { manualDailyPrice: 300, minDailyPrice: 400 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(listRepository.save).not.toHaveBeenCalled();
  });

  it('recusa diária base ausente ou não positiva', async () => {
    const { service } = makeService(makeAddress());
    await expect(
      service.saveHostInput('addr-1', 'user-1', { manualDailyPrice: 0 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.saveHostInput('addr-1', 'user-1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não permite gravar nem ler o imóvel de outro usuário (ownership)', async () => {
    const { service, listRepository } = makeService(makeAddress());

    await expect(
      service.saveHostInput('addr-1', 'intruder', { manualDailyPrice: 300 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getBaseline('addr-1', 'intruder')).rejects.toBeInstanceOf(NotFoundException);
    expect(listRepository.save).not.toHaveBeenCalled();
  });

  it('não grava histórico quando a diária não mudou', async () => {
    const { service, historyRepository } = makeService(
      makeAddress({ manualDailyPrice: 380, pricingInputSource: 'host_input' }),
    );
    await service.saveHostInput('addr-1', 'user-1', { manualDailyPrice: 380 });
    expect(historyRepository.save).not.toHaveBeenCalled();
  });

  it('getBaseline expõe a origem, o frescor e os dados do anfitrião', async () => {
    const now = new Date();
    const { service } = makeService(
      makeAddress({
        dailyPrice: 500,
        pricingInputSource: 'airbnb_checkout',
        pricingInputsUpdatedAt: new Date(now.getTime() - 60 * 86_400_000),
        essentialsSource: 'airbnb',
      }),
    );

    const result = await service.getBaseline('addr-1', 'user-1');
    expect(result).toMatchObject({
      dailyPrice: 500,
      source: 'airbnb',
      stale: true,
      essentialsSource: 'airbnb',
      minDailyPrice: null,
    });
  });
});
