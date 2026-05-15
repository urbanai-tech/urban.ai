jest.mock('p-limit', () => () => (fn: () => unknown) => fn());
jest.mock('../knn-engine/pricing-engine', () => ({ UrbanAIPricingEngine: class {} }));

import { PropriedadeService } from './propriedade.service';

describe('PropriedadeService public responses', () => {
  const makeService = (addressRepository: any) =>
    new PropriedadeService(
      addressRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

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
    const service = makeService(addressRepository);

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
});
