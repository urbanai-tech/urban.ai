import { ScheduledJobRunnerService } from 'src/admin-job-runs/scheduled-job-runner.service';
import { entitlementDouble } from 'src/subscription/entitlement.testing';
import { EmailTemplates } from './templates';
import { WeeklyEventReportService } from './weekly-event-report.service';
import { lastFullSaoPauloWeek, aggregateWeeklyPerformance } from './weekly-host-report';

/** Quinta 2026-05-21 09:00 BRT; semana reportada = 11/05 a 17/05. */
const NOW = new Date('2026-05-21T12:00:00Z');

const address = { id: 'address-1', ativo: true, list: { id: 'list-1', titulo: 'Studio <b>Paulista</b>' } };
const upcoming = {
  id: 'upcoming-1',
  criadoEm: new Date('2026-05-20T12:00:00Z'),
  endereco: address,
  evento: { id: 'e-up', nome: 'Feira & Cia', dataInicio: new Date('2026-05-28T12:00:00Z'), cidade: 'SP', estado: 'SP', relevancia: 80 },
  seuPrecoAtual: '200.00',
  precoSugerido: '260.00',
  diferencaPercentual: '30.00',
};
const applied = {
  id: 'applied-1',
  criadoEm: new Date('2026-05-05T12:00:00Z'),
  aceitoEm: new Date('2026-05-12T12:00:00Z'),
  aplicadoEm: new Date('2026-05-12T12:00:00Z'),
  endereco: address,
  evento: { id: 'e-old', nome: 'Show <script>x</script>', dataInicio: new Date('2026-05-16T22:00:00Z') },
  precoSugerido: '300.00',
  precoAplicado: '280.00',
};
const generated = {
  id: 'gen-1',
  criadoEm: new Date('2026-05-13T12:00:00Z'),
  endereco: address,
  evento: { id: 'e-gen', nome: 'Outro', dataInicio: new Date('2026-06-20T12:00:00Z') },
  precoSugerido: '250.00',
};

function makeService(opts: { weeklyReport?: boolean; eventRows?: any[]; performanceRows?: any[]; runner?: any } = {}) {
  const userRepo = { find: jest.fn().mockResolvedValue([{ id: 'user-1', username: 'Ana Host', email: 'ana@example.com', ativo: true }]) };
  const addressRepo = { find: jest.fn().mockResolvedValue([address]) };
  // 1ª consulta = eventos futuros (relations com 'endereco.list'); 2ª = desempenho da semana.
  const analisePrecoRepo = {
    find: jest.fn().mockImplementation(async (query: any) =>
      Array.isArray(query?.where) ? opts.performanceRows ?? [] : opts.eventRows ?? [],
    ),
  };
  const mailer = { sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 202 }) };
  const push = { sendToUser: jest.fn().mockResolvedValue({}) };
  const prefs = { getForUser: jest.fn().mockResolvedValue({ weeklyReport: opts.weeklyReport ?? true }) };
  const service = new WeeklyEventReportService(
    userRepo as any,
    addressRepo as any,
    analisePrecoRepo as any,
    mailer as any,
    push as any,
    prefs as any,
    entitlementDouble() as any,
    undefined,
    opts.runner,
  );
  return { service, userRepo, addressRepo, analisePrecoRepo, mailer, push, prefs };
}

describe('relatório semanal por anfitrião (resumo + resultados)', () => {
  it('envia UM e-mail por anfitrião com semana passada, próximas 2 semanas e lembrete de resultado', async () => {
    const { service, mailer, analisePrecoRepo } = makeService({
      eventRows: [upcoming],
      performanceRows: [applied, generated],
    });

    const summary = await service.processWeeklyReports(NOW);

    expect(summary).toMatchObject({ users: 1, sent: 1, failed: 0, skipped: 0 });
    expect(mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
    const [, subject, html, options] = mailer.sendHtmlEmail.mock.calls[0];
    expect(subject).toBe('Seu resumo semanal - My Urban');
    expect(options).toEqual({ unsubscribe: { userId: 'user-1', category: 'weekly_report' } });
    expect(html).toContain('Semana passada (11/05 a 17/05)');
    expect(html).toContain('Recomendações novas: 1 nova');
    expect(html).toContain('Preços aplicados: 1 aplicado');
    expect(html).toContain('sugerido R$ 300, você aplicou R$ 280');
    expect(html).toContain('Resultados registrados por você: sem dados');
    expect(html).toContain('Registre o resultado');
    expect(html).toContain('1 evento relevante começa nas próximas 2 semanas.');
    // a consulta de desempenho filtra por dono e por imóvel
    const performanceQuery = analisePrecoRepo.find.mock.calls.map((call) => call[0]).find((q) => Array.isArray(q.where));
    expect(performanceQuery.where).toHaveLength(5);
    expect(performanceQuery.where[0]).toMatchObject({ usuarioProprietario: { id: 'user-1' } });
  });

  it('escapa HTML de títulos e nomes de evento vindos de fora', async () => {
    const { service, mailer } = makeService({ eventRows: [upcoming], performanceRows: [applied] });
    await service.processWeeklyReports(NOW);
    const html: string = mailer.sendHtmlEmail.mock.calls[0][2];
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('Studio <b>Paulista</b>');
    expect(html).toContain('Studio &lt;b&gt;Paulista&lt;/b&gt;');
    expect(html).toContain('Show &lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('Feira &amp; Cia');
  });

  it('respeita o opt-out: weeklyReport=false não envia e-mail nem push, e nem consulta a semana', async () => {
    const { service, mailer, push, analisePrecoRepo } = makeService({ weeklyReport: false, eventRows: [upcoming], performanceRows: [applied] });
    const summary = await service.processWeeklyReports(NOW);
    expect(summary).toMatchObject({ users: 1, sent: 0, skipped: 1 });
    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(analisePrecoRepo.find).not.toHaveBeenCalled();
  });

  it('semana sem atividade e sem eventos: não envia e-mail vazio', async () => {
    const { service, mailer } = makeService({ eventRows: [], performanceRows: [] });
    const summary = await service.processWeeklyReports(NOW);
    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ sent: 0, skipped: 1 });
  });

  it('só pendência de resultado (sem eventos futuros): envia, com "sem dados" nos demais campos e sem zeros', async () => {
    const pendingOnly = {
      ...applied,
      id: 'pend',
      aceitoEm: new Date('2026-04-12T12:00:00Z'),
      aplicadoEm: new Date('2026-04-12T12:00:00Z'),
      criadoEm: new Date('2026-04-05T12:00:00Z'),
      evento: { id: 'e-p', nome: 'Feira antiga', dataInicio: new Date('2026-04-20T12:00:00Z') },
    };
    const { service, mailer, push } = makeService({ eventRows: [], performanceRows: [pendingOnly] });
    const summary = await service.processWeeklyReports(NOW);

    expect(summary.sent).toBe(1);
    const html: string = mailer.sendHtmlEmail.mock.calls[0][2];
    expect(html).toContain('Recomendações novas: sem dados');
    expect(html).toContain('Aceitas por você: sem dados');
    expect(html).toContain('Preços aplicados: sem dados');
    expect(html).toContain('Resultados registrados por você: sem dados');
    expect(html).toContain('Próximas 2 semanas: sem dados de eventos relevantes.');
    expect(html).toContain('Falta o resultado de 1 preço que você aplicou');
    expect(html).not.toMatch(/(novas|aceitas|aplicados|por você): 0/);
    expect(push.sendToUser.mock.calls[0][1].body).toBe('Falta registrar o resultado de 1 preço aplicado.');
  });

  it('só mostra receita que o anfitrião registrou', async () => {
    const withOutcome = {
      ...applied,
      resultadoRegistradoEm: new Date('2026-05-15T12:00:00Z'),
      reservaStatus: 'booked',
      receitaReal: '840.00',
      noitesReservadas: 3,
    };
    const { service, mailer } = makeService({ eventRows: [], performanceRows: [withOutcome] });
    await service.processWeeklyReports(NOW);
    const html: string = mailer.sendHtmlEmail.mock.calls[0][2];
    expect(html).toContain('Resultados registrados por você: 1 resultado, receita que você registrou R$ 840, 3 noites');
    expect(html).not.toContain('Registre o resultado');

    const noRevenue = { ...withOutcome, receitaReal: null, noitesReservadas: null, reservaStatus: 'not_booked' };
    const second = makeService({ eventRows: [], performanceRows: [noRevenue] });
    await second.service.processWeeklyReports(NOW);
    const html2: string = second.mailer.sendHtmlEmail.mock.calls[0][2];
    expect(html2).toContain('Resultados registrados por você: 1 resultado');
    expect(html2).not.toContain('receita que você registrou');
  });

  it('janela de "uma vez por semana" é a segunda 00:00 BRT (mesma para qualquer réplica na semana)', async () => {
    const runner = { runOncePerWindow: jest.fn(async (_n: string, _w: Date, _h: any, dup: any) => dup()) };
    const { service } = makeService({ runner });
    jest.useFakeTimers().setSystemTime(new Date('2026-05-25T11:30:00Z'));
    try {
      await service.runWeeklyCron();
    } finally {
      jest.useRealTimers();
    }
    expect(runner.runOncePerWindow.mock.calls[0][1].toISOString()).toBe('2026-05-25T03:00:00.000Z');
  });
});

describe('envio idempotente com 2 réplicas', () => {
  /** Simula o MySQL GET_LOCK/RELEASE_LOCK compartilhado entre réplicas + a tabela admin_job_runs. */
  function sharedMysql() {
    const locks = new Set<string>();
    const runs: any[] = [];
    const makeRunner = () => {
      const repository: any = {
        findOne: jest.fn(async ({ where }: any) =>
          runs.find((run) => run.name === where.name && run.status === 'success' && run.startedAt >= (where.startedAt as any)._value) ?? null,
        ),
        create: jest.fn((value: any) => ({ ...value })),
        save: jest.fn(async (value: any) => {
          if (!runs.includes(value)) runs.push(value);
          return value;
        }),
        update: jest.fn(async () => undefined),
      };
      const queryRunner: any = {
        connect: jest.fn(),
        release: jest.fn(),
        manager: { getRepository: () => repository },
        query: jest.fn(async (sql: string, params: string[]) => {
          if (sql.includes('GET_LOCK')) {
            if (locks.has(params[0])) return [{ acquired: 0 }];
            locks.add(params[0]);
            return [{ acquired: 1 }];
          }
          locks.delete(params[0]);
          return [{ released: 1 }];
        }),
      };
      const jobRunRepo: any = { manager: { connection: { options: { type: 'mysql' }, createQueryRunner: () => queryRunner } } };
      return { runner: new ScheduledJobRunnerService(jobRunRepo), repository };
    };
    return { makeRunner, runs };
  }

  it('duas réplicas disparando o cron ao mesmo tempo: o e-mail sai uma única vez', async () => {
    const { makeRunner } = sharedMysql();
    const a = makeRunner();
    const b = makeRunner();
    const replicaA = makeService({ eventRows: [upcoming], runner: a.runner });
    const replicaB = makeService({ eventRows: [upcoming], runner: b.runner });
    // A réplica A segura o lock enquanto envia; B chega no meio.
    let releaseSend: () => void = () => undefined;
    let markSending: () => void = () => undefined;
    const sending = new Promise<void>((resolve) => { markSending = resolve; });
    replicaA.mailer.sendHtmlEmail.mockImplementation(
      () => new Promise((resolve) => { releaseSend = () => resolve({ enviado: true, status: 202 }); markSending(); }),
    );

    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }).setSystemTime(NOW);
    try {
      const first = replicaA.service.runWeeklyCron();
      await sending;
      const second = await replicaB.service.runWeeklyCron();
      expect(second).toMatchObject({ sent: 0, users: 0 });
      releaseSend();
      const firstResult = await first;
      expect(firstResult).toMatchObject({ sent: 1 });
    } finally {
      jest.useRealTimers();
    }

    expect(replicaA.mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
    expect(replicaB.mailer.sendHtmlEmail).not.toHaveBeenCalled();
  });

  it('réplica atrasada (job da semana já concluído): não reenvia', async () => {
    const { makeRunner } = sharedMysql();
    const a = makeRunner();
    const b = makeRunner();
    const replicaA = makeService({ eventRows: [upcoming], runner: a.runner });
    const replicaB = makeService({ eventRows: [upcoming], runner: b.runner });

    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }).setSystemTime(NOW);
    try {
      // runAdminJobWithTracking grava a execução no repositório compartilhado do banco.
      await replicaA.service.runWeeklyCron();
      const late = await replicaB.service.runWeeklyCron();
      expect(late).toMatchObject({ sent: 0 });
    } finally {
      jest.useRealTimers();
    }
    expect(replicaA.mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
    expect(replicaB.mailer.sendHtmlEmail).not.toHaveBeenCalled();
  });
});

describe('template do resumo semanal', () => {
  it('imóvel sem nenhum dado diz "sem dados" e não inventa números', () => {
    const html = EmailTemplates.getWeeklyEventReportTemplate({
      nome: 'Ana',
      windowDays: 30,
      dashboardUrl: 'https://app.myurbanai.com/painel',
      properties: [{ title: 'Studio', totalEvents: 0, events: [], week: null, upcomingTwoWeeks: null }],
    });
    expect(html).toContain('Semana passada: sem dados de recomendações.');
    expect(html).toContain('Eventos nos próximos 30 dias: sem dados.');
    expect(html).toContain('Não há eventos relevantes mapeados');
  });

  it('agregação com semana vazia não gera entrada (cai em "sem dados" no template)', () => {
    const week = lastFullSaoPauloWeek(NOW);
    expect(aggregateWeeklyPerformance([], week, NOW).size).toBe(0);
  });
});
