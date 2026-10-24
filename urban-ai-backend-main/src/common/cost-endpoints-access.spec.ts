import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';

jest.mock('../connect/connect.service', () => ({ ConnectService: class {} }));
jest.mock('../propriedades/propriedade.service', () => ({ PropriedadeService: class {} }));
jest.mock('../payments/payments.service', () => ({ PaymentsService: class {} }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ConnectController } from '../connect/connect.controller';
import { ConnectService } from '../connect/connect.service';
import { EventoController } from '../evento/evento.controller';
import { EventoService } from '../evento/evento.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingCalculateService } from '../propriedades/pricing-calculate.service';
import { PropriedadeController } from '../propriedades/propriedade.controller';
import { PropriedadeService } from '../propriedades/propriedade.service';

/** Autentica via header `x-test-user` (simula o JWT já validado). */
class FakeJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.headers['x-test-user'];
    if (!userId) return false;
    req.user = { userId };
    return true;
  }
}

const ROLES: Record<string, { id: string; role: string; ativo: boolean }> = {
  'user-a': { id: 'user-a', role: 'user', ativo: true },
  'admin-1': { id: 'admin-1', role: 'admin', ativo: true },
};

describe('endpoints que disparam RapidAPI/scraping pago', () => {
  let app: INestApplication;
  const propriedadeService = {
    getPropertyDetails: jest.fn().mockResolvedValue({ bedrooms: 1 }),
    getPropertyCoordinates: jest.fn().mockResolvedValue({ latitude: 1, longitude: 2 }),
    buscarAlertPorId: jest.fn().mockResolvedValue({ comps: [] }),
    criarAlertaAirbnb: jest.fn().mockResolvedValue({ ok: true }),
    findByUserId: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 }),
  };
  const connectService = {
    getUserManagedListings: jest.fn().mockResolvedValue([]),
    getListingTotalPriceBRLForNext3Days: jest.fn().mockResolvedValue({ total: 1 }),
  };
  const eventoService = {
    findAllEventosPaginado: jest.fn().mockResolvedValue({ data: [] }),
    findEventosPorEnderecoPaginado: jest.fn().mockResolvedValue({ data: [] }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PropriedadeController, ConnectController, EventoController],
      providers: [
        RolesGuard,
        { provide: PropriedadeService, useValue: propriedadeService },
        { provide: PricingCalculateService, useValue: {} },
        { provide: ConnectService, useValue: connectService },
        { provide: PaymentsService, useValue: {} },
        { provide: EventoService, useValue: eventoService },
        {
          provide: DataSource,
          useValue: {
            getRepository: () => ({
              findOne: async ({ where }: any) => ROLES[where.id] ?? null,
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const adminOnly: Array<[string, string, string]> = [
    ['GET', '/propriedades/getPropertyDetails/123', 'getPropertyDetails'],
    ['GET', '/propriedades/123/coordinates', 'getPropertyCoordinates'],
    ['GET', '/propriedades/get-alert?id=abc', 'buscarAlertPorId'],
    ['POST', '/propriedades/airbnb/create-alert', 'criarAlertaAirbnb'],
    ['GET', '/connect/listing-price/123', 'getListingTotalPriceBRLForNext3Days'],
  ];

  it.each(adminOnly)('%s %s nega usuário comum (403) sem chamar o provedor pago', async (method, url, fn) => {
    const target = fn === 'getListingTotalPriceBRLForNext3Days' ? connectService : propriedadeService;
    const req = method === 'GET' ? request(app.getHttpServer()).get(url) : request(app.getHttpServer()).post(url).send({
      latitude: 1, longitude: 1, bedrooms: 1, bathrooms: 1, accommodates: 1,
    });
    await req.set('x-test-user', 'user-a').expect(403);
    expect((target as any)[fn]).not.toHaveBeenCalled();
  });

  it.each(adminOnly)('%s %s nega requisição sem autenticação', async (method, url) => {
    const agent = request(app.getHttpServer());
    const res = method === 'GET' ? await agent.get(url) : await agent.post(url).send({});
    expect([401, 403]).toContain(res.status);
  });

  it('admin continua acessando os endpoints restritos', async () => {
    await request(app.getHttpServer())
      .get('/propriedades/getPropertyDetails/123')
      .set('x-test-user', 'admin-1')
      .expect(200);
    await request(app.getHttpServer())
      .get('/connect/listing-price/123')
      .set('x-test-user', 'admin-1')
      .expect(200);
    expect(propriedadeService.getPropertyDetails).toHaveBeenCalledWith('123');
  });

  it('user-managed-listings exige ID numérico do host do Airbnb', async () => {
    await request(app.getHttpServer())
      .get('/connect/user-managed-listings/1462996042612541438')
      .set('x-test-user', 'user-a')
      .expect(200);
    expect(connectService.getUserManagedListings).toHaveBeenCalledWith('1462996042612541438');

    connectService.getUserManagedListings.mockClear();
    await request(app.getHttpServer())
      .get('/connect/user-managed-listings/abc%2F..%2Fx')
      .set('x-test-user', 'user-a')
      .expect(400);
    expect(connectService.getUserManagedListings).not.toHaveBeenCalled();
  });

  it('limit é limitado a 200 em event/all e propriedades/user', async () => {
    await request(app.getHttpServer())
      .get('/event/all?page=1&limit=1000000')
      .set('x-test-user', 'user-a')
      .expect(200);
    // O controller repassa o valor bruto; o serviço faz o clamp (testado abaixo).
    expect(eventoService.findAllEventosPaginado).toHaveBeenCalled();

    await request(app.getHttpServer())
      .get('/propriedades/user/?page=1&limit=99999')
      .set('x-test-user', 'user-a')
      .expect(200);
    expect(propriedadeService.findByUserId).toHaveBeenCalledWith('user-a', 1, 200);

    await request(app.getHttpServer())
      .get('/event?propriedadeId=p1&limit=99999')
      .set('x-test-user', 'user-a')
      .expect(200);
    expect(eventoService.findEventosPorEnderecoPaginado).toHaveBeenCalledWith('p1', 'user-a', 1, 200);
  });
});

describe('EventoService.findAllEventosPaginado', () => {
  it('aplica teto de 200 no take', async () => {
    const eventRepository = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
    const { EventoService: RealEventoService } = jest.requireActual('../evento/evento.service');
    const service = new RealEventoService({} as any, {} as any, {} as any, eventRepository as any);
    // Resolve o repositório de eventos independentemente da ordem do construtor.
    (service as any).eventRepository = eventRepository;

    await service.findAllEventosPaginado(2, 5_000);

    expect(eventRepository.findAndCount).toHaveBeenCalledWith({ skip: 200, take: 200 });
  });
});
