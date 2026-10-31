import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import {
  OWNER_REPORT_MAX_AUTO_ATTEMPTS,
  OwnerReportDeliveryService,
  resolveRetentionMonths,
} from './owner-report-delivery.service';
import { verifyOwnerToken } from './owner-report-token';

type Row = Record<string, any>;

const HOST = { id: 'host-1', username: 'Ana Host', email: 'ana@example.com', ativo: true };
const REF = 'u'.repeat(22);
const NOW = new Date('2026-11-03T12:00:00Z'); // terça: 2º dia útil de novembro (02/11 é segunda)

const baseOwner = (overrides: Row = {}): Row => ({
  id: 'owner-1',
  userId: HOST.id,
  name: 'Maria Souza',
  email: 'maria@example.com',
  monthlyReportEnabled: true,
  unsubscribedAt: null,
  unsubscribeRef: REF,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
});

const payload = (propertyCount = 1) => ({
  version: 1,
  period: { key: '2026-10' },
  summary: {
    propertyCount,
    propertiesWithRevenue: 0,
    totalRevenue: null,
    occupancyPct: null,
    averageDailyRate: null,
  },
  properties: [],
});

function matches(row: Row, criteria: Row): boolean {
  return Object.entries(criteria).every(([key, value]) => {
    if (value instanceof FindOperator) {
      if (value.type === 'in') return (value.value as unknown[]).includes(row[key]);
      if (value.type === 'lessThan') return row[key] < (value.value as any);
      return false;
    }
    return row[key] === value;
  });
}

function makeService(opts: { owners?: Row[]; reports?: Row[]; prefs?: Row; hosts?: Row[]; entitled?: boolean } = {}) {
  const owners = opts.owners ?? [baseOwner()];
  const reports: Row[] = opts.reports ?? [];
  const links: Row[] = [];
  const sent: Row[] = [];

  const reportRepo = {
    update: jest.fn(async (criteria: Row, patch: Row) => {
      let affected = 0;
      for (const report of reports) {
        if (matches(report, criteria)) {
          Object.assign(report, patch);
          affected += 1;
        }
      }
      return { affected };
    }),
    delete: jest.fn(async (_criteria?: Row) => ({ affected: 2 })),
  };
  const linkRepo = {
    update: jest.fn(async (criteria: Row, patch: Row) => {
      const link = links.find((l) => l.id === criteria.id);
      if (link) Object.assign(link, patch);
      return { affected: link ? 1 : 0 };
    }),
    delete: jest.fn(async (_criteria?: Row) => ({ affected: 3 })),
  };
  const ownerRepo = { find: jest.fn(async () => owners.filter((o) => o.monthlyReportEnabled && !o.unsubscribedAt)) };
  const userRepo = {
    find: jest.fn(async () => opts.hosts ?? [HOST]),
    findOne: jest.fn(async () => (opts.hosts ?? [HOST])[0] ?? null),
  };
  const ownerPropertyRepo = { find: jest.fn(async () => [{ ownerId: 'owner-1', addressId: 'addr-1' }]) };
  const analiseRepo = { find: jest.fn(async () => []) };
  const reportsService = {
    generate: jest.fn(async (owner: Row, period: string) => {
      let report = reports.find((r) => r.ownerId === owner.id && r.period === period);
      if (!report) {
        report = {
          id: `report-${reports.length + 1}`,
          ownerId: owner.id,
          period,
          payloadJson: JSON.stringify(payload()),
          emailStatus: 'pending',
          emailAttempts: 0,
          updatedAt: NOW,
        };
        reports.push(report);
      }
      return report;
    }),
    createLink: jest.fn(async () => {
      const link = { id: `link-${links.length + 1}`, expiresAt: new Date('2026-12-03T12:00:00Z'), revokedAt: null };
      links.push(link);
      return { link, url: 'https://app.exemplo.com/relatorio/TOKEN-DO-LINK' };
    }),
  };
  const ownersService = {
    findOwned: jest.fn(async (hostUserId: string, ownerId: string) => {
      const owner = owners.find((o) => o.id === ownerId && o.userId === hostUserId);
      if (!owner) throw new NotFoundException('Proprietário não encontrado');
      return owner;
    }),
  };
  const mailer = {
    sendHtmlEmail: jest.fn(async (to: Row, subject: string, html: string, options: Row): Promise<{ enviado: boolean; status: number; message?: string }> => {
      sent.push({ to, subject, html, options });
      return { enviado: true, status: 201 };
    }),
  };
  const preferences = { getForUser: jest.fn(async () => opts.prefs ?? { ownerReports: true }) };
  const entitlement = {
    filterEntitledUserIds: jest.fn(async (ids: string[]) => new Set(opts.entitled === false ? [] : ids)),
  };
  const service = new OwnerReportDeliveryService(
    ownerRepo as any,
    reportRepo as any,
    linkRepo as any,
    ownerPropertyRepo as any,
    userRepo as any,
    analiseRepo as any,
    reportsService as any,
    ownersService as any,
    mailer as any,
    preferences as any,
    entitlement as any,
  );
  return { service, owners, reports, links, sent, reportRepo, linkRepo, reportsService, mailer, analiseRepo, preferences, ownerRepo };
}

describe('OwnerReportDeliveryService', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OWNER_REPORT_TOKEN_SECRET: 'segredo-de-teste',
      API_URL: 'https://api.exemplo.com/',
      OWNER_REPORT_EMAIL_ENABLED: 'true',
    };
    delete process.env.OWNER_REPORT_SKIP_DATES;
    delete process.env.OWNER_REPORT_RETENTION_MONTHS;
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  describe('envio mensal idempotente por proprietário e mês', () => {
    it('envia o e-mail com link, descadastro próprio, List-Unsubscribe e registra o envio', async () => {
      const { service, sent, reports } = makeService();
      const summary = await service.sendMonthlyReports('2026-10', NOW);
      expect(summary).toEqual({ period: '2026-10', owners: 1, sent: 1, skipped: 0, failed: 0 });
      expect(sent).toHaveLength(1);
      const mail = sent[0];
      expect(mail.to).toEqual({ email: 'maria@example.com', name: 'Maria Souza' });
      expect(mail.subject).toContain('outubro de 2026');
      expect(mail.html).toContain('https://app.exemplo.com/relatorio/TOKEN-DO-LINK');
      expect(mail.html).toContain('Deixar de receber estes relatórios');
      const unsubscribeUrl = new URL(mail.options.headers['List-Unsubscribe'].slice(1, -1));
      expect(unsubscribeUrl.origin + unsubscribeUrl.pathname).toBe('https://api.exemplo.com/owner-reports/unsubscribe');
      expect(mail.options.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      // O token de descadastro é do proprietário (ref), não do usuário.
      expect(verifyOwnerToken('unsub', unsubscribeUrl.searchParams.get('token'))?.random).toBe(REF);
      expect(reports[0]).toMatchObject({ emailStatus: 'sent', emailAttempts: 1, emailFailureReason: null });
      expect(reports[0].emailSentAt).toEqual(NOW);
    });

    it('rodar de novo (ou dois processos ao mesmo tempo) NÃO reenvia', async () => {
      const { service, mailer } = makeService();
      await service.sendMonthlyReports('2026-10', NOW);
      const second = await service.sendMonthlyReports('2026-10', new Date('2026-11-04T12:00:00Z'));
      expect(second.sent).toBe(0);
      expect(second.skipped).toBe(1);
      expect(mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);

      const concurrent = makeService();
      const results = await Promise.all([
        concurrent.service.sendMonthlyReports('2026-10', NOW),
        concurrent.service.sendMonthlyReports('2026-10', NOW),
      ]);
      expect(results.reduce((sum, r) => sum + r.sent, 0)).toBe(1);
      expect(concurrent.mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
    });

    it('falha do provedor: marca failed, revoga o link que ninguém recebeu e permite nova tentativa', async () => {
      const { service, mailer, reports, links } = makeService();
      mailer.sendHtmlEmail.mockResolvedValueOnce({ enviado: false, status: 500, message: 'Brevo recusou maria@example.com' });
      const first = await service.sendMonthlyReports('2026-10', NOW);
      expect(first.failed).toBe(1);
      expect(reports[0].emailStatus).toBe('failed');
      expect(reports[0].emailAttempts).toBe(1);
      // O motivo gravado não carrega e-mail de terceiro.
      expect(reports[0].emailFailureReason).not.toContain('maria@example.com');
      expect(links[0].revokedAt).toEqual(NOW);

      const retry = await service.sendMonthlyReports('2026-10', new Date('2026-11-04T12:00:00Z'));
      expect(retry.sent).toBe(1);
      expect(reports[0].emailStatus).toBe('sent');
      expect(reports[0].emailAttempts).toBe(2);
    });

    it('depois de 3 falhas automáticas desiste; o envio manual do anfitrião ainda pode tentar', async () => {
      const { service, mailer, reports } = makeService({
        reports: [{ id: 'report-1', ownerId: 'owner-1', period: '2026-10', payloadJson: JSON.stringify(payload()), emailStatus: 'failed', emailAttempts: OWNER_REPORT_MAX_AUTO_ATTEMPTS, updatedAt: NOW }],
      });
      const auto = await service.sendMonthlyReports('2026-10', NOW);
      expect(auto.sent).toBe(0);
      expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
      const manual = await service.sendNowForHost(HOST.id, 'owner-1', '2026-10', NOW);
      expect(manual).toEqual({ status: 'sent' });
      expect(reports[0].emailStatus).toBe('sent');
    });

    it('linha presa em "sending" por um processo que morreu volta a ser tentável', async () => {
      const { service, mailer } = makeService({
        reports: [{ id: 'report-1', ownerId: 'owner-1', period: '2026-10', payloadJson: JSON.stringify(payload()), emailStatus: 'sending', emailAttempts: 1, updatedAt: new Date('2026-11-03T11:00:00Z') }],
      });
      const summary = await service.sendMonthlyReports('2026-10', NOW);
      expect(summary.sent).toBe(1);
      expect(mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
      // Mas "sending" recente (outro processo trabalhando agora) não é reenviado.
      const fresh = makeService({
        reports: [{ id: 'report-1', ownerId: 'owner-1', period: '2026-10', payloadJson: JSON.stringify(payload()), emailStatus: 'sending', emailAttempts: 1, updatedAt: new Date('2026-11-03T11:59:00Z') }],
      });
      expect((await fresh.service.sendMonthlyReports('2026-10', NOW)).sent).toBe(0);
      expect(fresh.mailer.sendHtmlEmail).not.toHaveBeenCalled();
    });

    it('sem URL pública da API ou sem segredo NÃO envia (sem descadastro não há e-mail)', async () => {
      delete process.env.API_URL;
      const { service, mailer, reports } = makeService();
      const summary = await service.sendMonthlyReports('2026-10', NOW);
      expect(summary.failed).toBe(1);
      expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
      expect(reports[0].emailStatus).toBe('failed');
    });
  });

  describe('quem NÃO recebe', () => {
    it('proprietário descadastrado, com envio desligado ou sem e-mail não é nem considerado', async () => {
      const { service, mailer } = makeService({
        owners: [baseOwner({ unsubscribedAt: new Date('2026-10-20T00:00:00Z') }), baseOwner({ id: 'o2', monthlyReportEnabled: false })],
      });
      const summary = await service.sendMonthlyReports('2026-10', NOW);
      expect(summary.owners).toBe(0);
      expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
      const direct = makeService();
      expect(await direct.service.deliver(baseOwner({ unsubscribedAt: NOW }) as any, HOST as any, '2026-10', NOW, { respectAttemptCap: true })).toBe('skipped');
      expect(direct.mailer.sendHtmlEmail).not.toHaveBeenCalled();
    });

    it('respeita communication-preferences do anfitrião (ownerReports desligado) e o direito de uso do plano', async () => {
      const off = makeService({ prefs: { ownerReports: false } });
      expect((await off.service.sendMonthlyReports('2026-10', NOW)).skipped).toBe(1);
      expect(off.mailer.sendHtmlEmail).not.toHaveBeenCalled();

      const noPlan = makeService({ entitled: false });
      expect((await noPlan.service.sendMonthlyReports('2026-10', NOW)).skipped).toBe(1);
      expect(noPlan.mailer.sendHtmlEmail).not.toHaveBeenCalled();

      const inactive = makeService({ hosts: [] });
      expect((await inactive.service.sendMonthlyReports('2026-10', NOW)).skipped).toBe(1);
    });

    it('sem imóvel vinculado não envia relatório vazio', async () => {
      const { service, mailer, reports } = makeService();
      reports.push({ id: 'report-1', ownerId: 'owner-1', period: '2026-10', payloadJson: JSON.stringify(payload(0)), emailStatus: 'pending', emailAttempts: 0, updatedAt: NOW });
      const summary = await service.sendMonthlyReports('2026-10', NOW);
      expect(summary.skipped).toBe(1);
      expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    });
  });

  describe('envio manual do anfitrião', () => {
    it('exige o envio por e-mail ligado no ambiente (padrão desligado)', async () => {
      delete process.env.OWNER_REPORT_EMAIL_ENABLED;
      const { service, mailer } = makeService();
      await expect(service.sendNowForHost(HOST.id, 'owner-1', '2026-10', NOW)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    });

    it('não envia a quem se descadastrou, nem de proprietário alheio', async () => {
      const unsubscribed = makeService({ owners: [baseOwner({ unsubscribedAt: new Date('2026-10-20T00:00:00Z') })] });
      await expect(unsubscribed.service.sendNowForHost(HOST.id, 'owner-1', '2026-10', NOW)).rejects.toBeInstanceOf(ConflictException);
      const other = makeService();
      await expect(other.service.sendNowForHost('host-2', 'owner-1', '2026-10', NOW)).rejects.toBeInstanceOf(NotFoundException);
      expect(other.mailer.sendHtmlEmail).not.toHaveBeenCalled();
    });

    it('é idempotente: segundo clique devolve already_sent', async () => {
      const { service, mailer } = makeService();
      expect(await service.sendNowForHost(HOST.id, 'owner-1', '2026-10', NOW)).toEqual({ status: 'sent' });
      expect(await service.sendNowForHost(HOST.id, 'owner-1', '2026-10', NOW)).toEqual({ status: 'already_sent' });
      expect(mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('job diário (1º dia útil, America/Sao_Paulo)', () => {
    it('só envia nos primeiros dias úteis do mês e só o mês anterior', async () => {
      // 03/11 é o 2º dia útil (dentro da janela padrão de 3).
      const inside = makeService();
      const summary = await inside.service.processDaily(NOW);
      expect(summary.send).toMatchObject({ period: '2026-10', sent: 1 });

      // 05/11 é o 4º dia útil: fora da janela.
      const outside = makeService();
      expect((await outside.service.processDaily(new Date('2026-11-05T12:00:00Z'))).send).toBeNull();
      expect(outside.mailer.sendHtmlEmail).not.toHaveBeenCalled();

      // Sábado nunca envia.
      const weekend = makeService();
      expect((await weekend.service.processDaily(new Date('2026-11-07T12:00:00Z'))).send).toBeNull();
    });

    it('feriado informado em OWNER_REPORT_SKIP_DATES empurra o primeiro dia útil', async () => {
      process.env.OWNER_REPORT_SKIP_DATES = '2026-11-02';
      process.env.OWNER_REPORT_SEND_WINDOW_BUSINESS_DAYS = '1';
      const { service } = makeService();
      // 03/11 passa a ser o 1º dia útil.
      expect((await service.processDaily(NOW)).send).toMatchObject({ sent: 1 });
      delete process.env.OWNER_REPORT_SEND_WINDOW_BUSINESS_DAYS;
    });

    it('o mês de referência é o do calendário de São Paulo (01/11 01:30Z ainda é outubro em SP)', async () => {
      process.env.OWNER_REPORT_SKIP_DATES = '';
      const { service } = makeService();
      // 02/11 00:30Z = 01/11 21:30 em SP (domingo): nem é dia útil.
      expect((await service.processDaily(new Date('2026-11-02T00:30:00Z'))).send).toBeNull();
    });

    it('com o envio desligado (padrão) não manda e-mail a terceiros', async () => {
      delete process.env.OWNER_REPORT_EMAIL_ENABLED;
      const { service, mailer } = makeService();
      const summary = await service.processDaily(NOW);
      expect(summary.send).toBeNull();
      expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    });

    it('falha numa fase não impede as outras', async () => {
      const { service, reportRepo } = makeService();
      reportRepo.delete.mockRejectedValueOnce(new Error('db'));
      const summary = await service.processDaily(NOW);
      expect(summary.purged).toBeNull();
      expect(summary.send).toMatchObject({ sent: 1 });
    });
  });

  describe('lembrete de fim de mês ao anfitrião', () => {
    const REMINDER_DAY = new Date('2026-11-28T12:00:00Z'); // 30/11 - 2

    it('o dia do lembrete é 2 dias antes do fim do mês', () => {
      const { service } = makeService();
      expect(service.reminderDayKey('2026-11-10')).toBe('2026-11-28');
      expect(service.reminderDayKey('2026-02-03')).toBe('2026-02-26');
    });

    it('avisa só quem tem aplicação do mês sem resultado registrado', async () => {
      const { service, analiseRepo, sent } = makeService();
      analiseRepo.find.mockResolvedValue([
        { id: 'a1', aplicadoEm: new Date('2026-11-03T12:00:00Z'), precoAplicado: 300, resultadoRegistradoEm: null, evento: { dataInicio: new Date('2026-11-10T15:00:00Z') } },
        // evento de outro mês não entra na contagem do lembrete
        { id: 'a2', aplicadoEm: new Date('2026-10-03T12:00:00Z'), precoAplicado: 300, resultadoRegistradoEm: null, evento: { dataInicio: new Date('2026-10-10T15:00:00Z') } },
        // evento futuro (ainda não aconteceu) não é pendência
        { id: 'a3', aplicadoEm: new Date('2026-11-03T12:00:00Z'), precoAplicado: 300, resultadoRegistradoEm: null, evento: { dataInicio: new Date('2026-11-30T15:00:00Z') } },
      ]);
      const summary = await service.sendMonthEndReminders(REMINDER_DAY);
      expect(summary).toMatchObject({ hosts: 1, sent: 1, skipped: 0, failed: 0 });
      expect(sent[0].to.email).toBe('ana@example.com');
      expect(sent[0].html).toContain('1 preço aplicado ainda sem resultado registrado');
      expect(sent[0].options).toEqual({ unsubscribe: { userId: HOST.id, category: 'owner_reports' } });
    });

    it('sem pendência, ou com a preferência ownerReports desligada, não incomoda', async () => {
      const none = makeService();
      expect((await none.service.sendMonthEndReminders(REMINDER_DAY)).skipped).toBe(1);
      expect(none.mailer.sendHtmlEmail).not.toHaveBeenCalled();

      const off = makeService({ prefs: { ownerReports: false } });
      expect((await off.service.sendMonthEndReminders(REMINDER_DAY)).skipped).toBe(1);
      expect(off.analiseRepo.find).not.toHaveBeenCalled();
    });

    it('o job diário dispara o lembrete uma vez no dia certo (flag OWNER_REPORT_REMINDER_ENABLED)', async () => {
      const runner = { runOncePerWindow: jest.fn(async (_n: string, _w: Date, handler: () => Promise<unknown>) => handler()), run: jest.fn() };
      const built = makeService();
      const service = new OwnerReportDeliveryService(
        { find: jest.fn(async () => []) } as any, { delete: jest.fn(async () => ({ affected: 0 })) } as any, { delete: jest.fn(async () => ({ affected: 0 })) } as any,
        {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, runner as any,
      );
      await service.processDaily(REMINDER_DAY);
      expect(runner.runOncePerWindow).toHaveBeenCalledWith('owner-report-reminder', expect.any(Date), expect.any(Function), expect.any(Function));
      runner.runOncePerWindow.mockClear();
      await service.processDaily(NOW);
      expect(runner.runOncePerWindow).not.toHaveBeenCalled();
      process.env.OWNER_REPORT_REMINDER_ENABLED = 'false';
      await service.processDaily(REMINDER_DAY);
      expect(runner.runOncePerWindow).not.toHaveBeenCalled();
      expect(built.mailer.sendHtmlEmail).not.toHaveBeenCalled();
    });
  });

  describe('retenção (ADR 0027)', () => {
    it('apaga relatórios além do prazo (padrão 12 meses) e links vencidos/revogados há mais de 30 dias', async () => {
      const { service, reportRepo, linkRepo } = makeService();
      const result = await service.purgeExpired(NOW);
      expect(result).toEqual({ reports: 2, links: 6 });
      // Novembro/2026 - 12 meses = nov/2025: período < 2025-11 sai (relatório de outubro/2025 fechou há 12 meses).
      const reportCriteria = reportRepo.delete.mock.calls[0][0] as Row;
      expect((reportCriteria.period as FindOperator<string>).value).toBe('2025-11');
      expect(linkRepo.delete).toHaveBeenCalledTimes(2);
      const [expired, revoked] = linkRepo.delete.mock.calls.map((call) => call[0] as Row);
      const cutoff = new Date('2026-10-04T12:00:00Z').getTime();
      expect((expired.expiresAt as FindOperator<Date>).value.getTime()).toBe(cutoff);
      expect((revoked.revokedAt as FindOperator<Date>).value.getTime()).toBe(cutoff);
    });

    it('prazo configurável por env, com piso e teto', () => {
      expect(resolveRetentionMonths()).toBe(12);
      process.env.OWNER_REPORT_RETENTION_MONTHS = '6';
      expect(resolveRetentionMonths()).toBe(6);
      process.env.OWNER_REPORT_RETENTION_MONTHS = '999';
      expect(resolveRetentionMonths()).toBe(60);
      process.env.OWNER_REPORT_RETENTION_MONTHS = '0';
      expect(resolveRetentionMonths()).toBe(12);
    });
  });
});
