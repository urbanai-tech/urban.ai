import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventIdentityService } from '../evento/event-identity.service';
import { EventsCsvImportService } from '../evento/events-csv-import.service';
import { EventReferenceService } from './event-reference.service';
import { EventCoveragePublicService } from './event-coverage-public.service';
import { FakeRepo } from './fake-repo.testkit';

const identity = new EventIdentityService();
const csv = new EventsCsvImportService(null as any);

function build() {
  const refRepo = new FakeRepo<any>();
  const voteRepo = new FakeRepo<any>();
  const service = new EventReferenceService(refRepo as any, voteRepo as any, identity, csv);
  return { service, refRepo, voteRepo };
}

const buf = (text: string) => Buffer.from(text, 'utf8');

describe('importação por CSV da lista de referência', () => {
  const header = 'nome,venue,dataInicio,cidade,categoria,porte,url\n';

  it('cria referências aprovadas pelo admin, com venue canônico, porte e evidência', async () => {
    const { service, refRepo } = build();
    const summary = await service.importCsv(
      buf(
        header +
          '"Palmeiras x Corinthians","Arena Palmeiras","2026-11-14 18:30","São Paulo","Esporte","grande","https://www.allianzparque.com.br/"\n' +
          'Festival Sem Venue Conhecido,Casa do João,15/11/2026 22:00,,show,,\n',
      ),
      'user-9',
    );
    expect(summary).toMatchObject({ parsedRows: 2, created: 2, updated: 0, invalidRows: [] });
    const [a, b] = refRepo.rows;
    expect(a).toMatchObject({
      venueKey: 'allianz-parque',
      venueName: 'Allianz Parque',
      dateKey: '2026-11-14',
      size: 'grande',
      category: 'esporte',
      status: 'aprovado',
      origin: 'csv',
      approvedBy: 'user-9',
      evidenceUrls: ['https://www.allianzparque.com.br/'],
    });
    expect(b).toMatchObject({ venueKey: null, venueName: 'Casa do João', size: 'medio', dateKey: '2026-11-15' });
  });

  it('reimportar o mesmo arquivo não duplica (fingerprint) e só acrescenta evidência nova', async () => {
    const { service, refRepo } = build();
    const row = (url: string) => header + `"Jogo X","Allianz Parque","2026-11-14","","esporte","grande","${url}"\n`;
    await service.importCsv(buf(row('')), 'u');
    const again = await service.importCsv(buf(row('')), 'u');
    expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    const withUrl = await service.importCsv(buf(row('https://a.com/x')), 'u');
    expect(withUrl.updated).toBe(1);
    expect(refRepo.rows).toHaveLength(1);
    expect(refRepo.rows[0].evidenceUrls).toEqual(['https://a.com/x']);
  });

  it('com status=candidato entra na fila; reimportar como aprovado promove', async () => {
    const { service, refRepo } = build();
    const row = header + '"Jogo X","Allianz Parque","2026-11-14","","","",""\n';
    await service.importCsv(buf(row), 'u', { status: 'candidato' });
    expect(refRepo.rows[0]).toMatchObject({ status: 'candidato', approvedBy: null });
    const promoted = await service.importCsv(buf(row), 'u');
    expect(promoted.updated).toBe(1);
    expect(refRepo.rows[0]).toMatchObject({ status: 'aprovado', approvedBy: 'u' });
  });

  it('lista as linhas inválidas sem abortar as boas', async () => {
    const { service, refRepo } = build();
    const summary = await service.importCsv(
      buf(
        header +
          'Ok Evento,Audio,2026-12-01,,,,\n' +
          ',Audio,2026-12-01,,,,\n' +
          'Sem Data,Audio,,,,,\n' +
          'Data Ruim,Audio,31/02/2026,,,,\n' +
          'Sem Venue,,2026-12-01,,,,\n' +
          'Url Ruim,Audio,2026-12-01,,,,javascript:alert(1)\n',
      ),
      'u',
    );
    expect(summary.created).toBe(1);
    expect(summary.invalidRows.map((r) => r.line)).toEqual([3, 4, 5, 6, 7]);
    expect(refRepo.rows).toHaveLength(1);
  });

  it('valida arquivo e cabeçalho', async () => {
    const { service } = build();
    await expect(service.importCsv(Buffer.alloc(0), 'u')).rejects.toThrow(BadRequestException);
    await expect(service.importCsv(buf('nome,venue\nA,B\n'), 'u')).rejects.toThrow(/data/);
    await expect(service.importCsv(buf('nome,venue,data\n'), 'u')).rejects.toThrow(/sem linhas/);
  });
});

describe('decisão humana e fila de conflitos', () => {
  it('aprova e rejeita registrando quem decidiu, e devolve before/after para a auditoria', async () => {
    const { service, refRepo } = build();
    refRepo.rows.push({ id: 'r1', name: 'X', status: 'conflito', conflictReason: 'divergência', dateKey: '2026-11-10', venueName: 'Audio' });
    const approved = await service.approve('r1', 'user-1', 'confirmado no site oficial');
    expect(approved.before.status).toBe('conflito');
    expect(approved.after).toMatchObject({ status: 'aprovado', approvedBy: 'user-1', conflictReason: null, decisionNote: 'confirmado no site oficial' });
    const rejected = await service.reject('r1', 'user-2');
    expect(rejected.after).toMatchObject({ status: 'rejeitado', approvedBy: 'user-2' });
    await expect(service.approve('nao-existe', 'u')).rejects.toThrow(NotFoundException);
  });

  it('a fila traz só conflitos, com os votos de cada referência', async () => {
    const { service, refRepo, voteRepo } = build();
    refRepo.rows.push(
      { id: 'c1', name: 'A', status: 'conflito', dateKey: '2026-11-10' },
      { id: 'c2', name: 'B', status: 'aprovado', dateKey: '2026-11-10' },
    );
    voteRepo.rows.push({ id: 'v1', referenceId: 'c1', validatorKey: 'web:a.com', validatorKind: 'tavily', verdict: 'support', createdAt: new Date() });
    const queue = await service.conflictQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].votes[0]).toMatchObject({ validatorKey: 'web:a.com', verdict: 'support' });
  });

  it('a lista filtra por status e recusa status inválido', async () => {
    const { service, refRepo } = build();
    refRepo.rows.push(
      { id: '1', name: 'A', status: 'aprovado', dateKey: '2026-11-10' },
      { id: '2', name: 'B', status: 'candidato', dateKey: '2026-11-11' },
    );
    expect((await service.list({ status: 'candidato' })).items.map((i) => i.id)).toEqual(['2']);
    await expect(service.list({ status: 'qualquer' })).rejects.toThrow(BadRequestException);
  });
});

describe('endpoint público (agregados, cache, sem 500)', () => {
  const rows = [
    { snapshotDate: '2026-12-01', scope: 'past30', dimension: 'total', dimensionValue: 'all', referenceTotal: 40, referenceMatched: 36, recallPct: '90.00' },
    { snapshotDate: '2026-12-01', scope: 'past30', dimension: 'size', dimensionValue: 'grande', referenceTotal: 25, referenceMatched: 23, recallPct: '92.00' },
  ];

  it('publica o recall dos grandes eventos só depois de 4 semanas e cacheia o resultado', async () => {
    const coverage = {
      latestSnapshotDate: jest.fn().mockResolvedValue('2026-12-01'),
      firstSnapshotDate: jest.fn().mockResolvedValue('2026-11-01'),
      snapshotRowsFor: jest.fn().mockResolvedValue(rows),
    };
    const service = new EventCoveragePublicService(coverage as any);
    const first = await service.summary();
    expect(first).toMatchObject({ status: 'measured', recallLargeEventsPct: 92 });
    await service.summary();
    expect(coverage.latestSnapshotDate).toHaveBeenCalledTimes(1);
  });

  it('antes de 4 semanas devolve o texto honesto de medição', async () => {
    const coverage = {
      latestSnapshotDate: jest.fn().mockResolvedValue('2026-12-01'),
      firstSnapshotDate: jest.fn().mockResolvedValue('2026-11-25'),
      snapshotRowsFor: jest.fn().mockResolvedValue(rows),
    };
    const summary = await new EventCoveragePublicService(coverage as any).summary();
    expect(summary.status).toBe('measuring');
    expect(summary.recallLargeEventsPct).toBeNull();
    expect(summary.message).toMatch(/4 semanas/);
  });

  it('sem snapshot ou com falha de leitura, responde "medindo" em vez de erro', async () => {
    const empty = { latestSnapshotDate: jest.fn().mockResolvedValue(null) };
    expect((await new EventCoveragePublicService(empty as any).summary()).status).toBe('measuring');
    const broken = { latestSnapshotDate: jest.fn().mockRejectedValue(new Error('db fora')) };
    const summary = await new EventCoveragePublicService(broken as any).summary();
    expect(summary).toMatchObject({ status: 'measuring', recallLargeEventsPct: null, eventsTracked: 0 });
  });
});
