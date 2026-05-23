import { WeeklyEventReportService } from './weekly-event-report.service';

describe('WeeklyEventReportService', () => {
  const makeService = () => {
    const userRepo = {
      find: jest.fn(),
    };
    const addressRepo = {
      find: jest.fn(),
    };
    const analisePrecoRepo = {
      find: jest.fn(),
    };
    const mailer = {
      sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 202 }),
    };
    const pushNotificationService = {
      sendToUser: jest.fn().mockResolvedValue({ enabled: true, attempted: 1, sent: 1, failed: 0 }),
    };
    const communicationPreferences = {
      getForUser: jest.fn().mockResolvedValue({ weeklyReport: true }),
    };

    const service = new WeeklyEventReportService(
      userRepo as any,
      addressRepo as any,
      analisePrecoRepo as any,
      mailer as any,
      pushNotificationService as any,
      communicationPreferences as any,
    );

    return {
      service,
      userRepo,
      addressRepo,
      analisePrecoRepo,
      mailer,
      pushNotificationService,
      communicationPreferences,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WEEKLY_EVENT_REPORT_LOOKAHEAD_DAYS;
    delete process.env.WEEKLY_EVENT_REPORT_EVENTS_PER_PROPERTY;
  });

  it('envia um resumo semanal por imovel para usuarios ativos com eventos relevantes', async () => {
    const { service, userRepo, addressRepo, analisePrecoRepo, mailer, pushNotificationService } = makeService();
    userRepo.find.mockResolvedValue([
      { id: 'user-1', username: 'Ana Host', email: 'ana@example.com', ativo: true },
    ]);
    addressRepo.find.mockResolvedValue([
      {
        id: 'address-1',
        ativo: true,
        list: { id: 'list-1', titulo: 'Studio Paulista' },
      },
    ]);
    analisePrecoRepo.find.mockResolvedValue([
      {
        id: 'analysis-1',
        criadoEm: new Date('2026-05-20T12:00:00Z'),
        endereco: { id: 'address-1', list: { id: 'list-1', titulo: 'Studio Paulista' } },
        evento: {
          id: 'event-1',
          nome: 'Sao Paulo Tech Week',
          dataInicio: new Date('2026-05-25T12:00:00Z'),
          cidade: 'Sao Paulo',
          estado: 'SP',
          relevancia: 88,
          expectedAttendance: 20000,
        },
        seuPrecoAtual: '200.00',
        precoSugerido: '260.00',
        diferencaPercentual: '30.00',
        recomendacao: 'Aumentar por demanda de evento corporativo',
      },
    ]);

    const result = await service.processWeeklyReports(new Date('2026-05-21T12:00:00Z'));

    expect(userRepo.find).toHaveBeenCalledWith({ where: { ativo: true } });
    expect(addressRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { id: 'user-1' }, ativo: true },
        relations: ['list', 'user'],
      }),
    );
    expect(analisePrecoRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: ['endereco', 'endereco.list', 'evento'],
      }),
    );
    expect(mailer.sendHtmlEmail).toHaveBeenCalledWith(
      { email: 'ana@example.com', name: 'Ana Host' },
      'Radar semanal de eventos - Urban AI',
      expect.stringContaining('Sao Paulo Tech Week'),
    );
    expect(mailer.sendHtmlEmail.mock.calls[0][2]).toContain('Studio Paulista');
    expect(pushNotificationService.sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        title: 'Radar semanal de eventos',
        url: '/painel?source=pwa_push_weekly_report',
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      users: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
      lookaheadDays: 30,
    });
  });

  it('nao envia email quando o usuario ativo nao tem imovel com evento futuro', async () => {
    const { service, userRepo, addressRepo, analisePrecoRepo, mailer, pushNotificationService } = makeService();
    userRepo.find.mockResolvedValue([
      { id: 'user-1', username: 'Ana Host', email: 'ana@example.com', ativo: true },
    ]);
    addressRepo.find.mockResolvedValue([
      { id: 'address-1', ativo: true, list: { id: 'list-1', titulo: 'Studio Paulista' } },
    ]);
    analisePrecoRepo.find.mockResolvedValue([]);

    const result = await service.processWeeklyReports(new Date('2026-05-21T12:00:00Z'));

    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    expect(pushNotificationService.sendToUser).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      users: 1,
      sent: 0,
      skipped: 1,
      failed: 0,
    });
  });
});
