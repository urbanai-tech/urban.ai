import { Test, TestingModule } from '@nestjs/testing';
import { EventsCsvImportService } from './events-csv-import.service';
import { EventsIngestService } from './events-ingest.service';

describe('EventsCsvImportService', () => {
  let service: EventsCsvImportService;
  let ingestMock: { ingestBatch: jest.Mock };

  beforeEach(async () => {
    ingestMock = {
      ingestBatch: jest.fn().mockResolvedValue({
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        bySource: {},
        results: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsCsvImportService,
        { provide: EventsIngestService, useValue: ingestMock },
      ],
    }).compile();

    service = module.get(EventsCsvImportService);
  });

  // ============== parseCsv ==============

  describe('parseCsv', () => {
    it('parseia CSV simples', () => {
      const rows = service.parseCsv('a,b,c\n1,2,3\n');
      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]);
    });

    it('respeita aspas em células com vírgula', () => {
      const rows = service.parseCsv('nome,endereco\n"Show","Rua X, 100"\n');
      expect(rows[1]).toEqual(['Show', 'Rua X, 100']);
    });

    it('trata aspas duplas escapadas', () => {
      const rows = service.parseCsv('a\n"Hello ""world"""\n');
      expect(rows[1]).toEqual(['Hello "world"']);
    });

    it('CRLF e LF', () => {
      const rows = service.parseCsv('a,b\r\n1,2\n3,4\r\n');
      expect(rows).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('última linha sem newline', () => {
      const rows = service.parseCsv('a,b\n1,2');
      expect(rows[1]).toEqual(['1', '2']);
    });
  });

  // ============== importFromBuffer ==============

  describe('importFromBuffer', () => {
    it('rejeita buffer vazio', async () => {
      await expect(service.importFromBuffer(Buffer.alloc(0))).rejects.toThrow();
    });

    it('rejeita CSV sem dados (só cabeçalho)', async () => {
      const buf = Buffer.from('nome,dataInicio\n');
      await expect(service.importFromBuffer(buf)).rejects.toThrow(/cabe/);
    });

    it('parseia e ingere CSV bem formado', async () => {
      const csv = [
        'nome,dataInicio,enderecoCompleto,latitude,longitude,categoria,venueType',
        '"RD Summit 2026","2026-10-15T08:00:00","São Paulo Expo","-23.6258","-46.6469","conference","convention_center"',
        '"Palmeiras x Santos","2026-05-10T16:00:00","Allianz Parque","","","esporte","stadium"',
      ].join('\n');

      ingestMock.ingestBatch.mockResolvedValue({
        total: 2,
        created: 2,
        updated: 0,
        skipped: 0,
        bySource: { 'admin-csv-import': { created: 2, updated: 0, skipped: 0 } },
        results: [],
      });

      const r = await service.importFromBuffer(Buffer.from(csv));

      expect(r.parsedRows).toBe(2);
      expect(r.invalidRows).toEqual([]);
      expect(ingestMock.ingestBatch).toHaveBeenCalledTimes(1);

      const sentEvents = ingestMock.ingestBatch.mock.calls[0][0];
      expect(sentEvents).toHaveLength(2);

      // RD Summit com geo
      expect(sentEvents[0].nome).toBe('RD Summit 2026');
      expect(sentEvents[0].latitude).toBe(-23.6258);
      expect(sentEvents[0].venueType).toBe('convention_center');
      expect(sentEvents[0].source).toBe('admin-csv-import');

      // Palmeiras sem geo (lat/lng vazios) → backend marca pendingGeocode
      expect(sentEvents[1].nome).toBe('Palmeiras x Santos');
      expect(sentEvents[1].latitude).toBeUndefined();
      expect(sentEvents[1].longitude).toBeUndefined();
    });

    it('marca linhas inválidas com motivo', async () => {
      const csv = [
        'nome,dataInicio',
        ',2026-10-15', // sem nome
        'Show X,', // sem data
        'Show Y,2026-05-10', // OK
      ].join('\n');

      const r = await service.importFromBuffer(Buffer.from(csv));

      expect(r.parsedRows).toBe(3);
      expect(r.invalidRows).toHaveLength(2);
      expect(r.invalidRows[0].line).toBe(2);
      expect(r.invalidRows[1].line).toBe(3);
    });

    it('força source admin-csv-import (não aceita override do CSV)', async () => {
      const csv = [
        'nome,dataInicio,source',
        'Show A,2026-05-10,fake-source-do-csv',
      ].join('\n');

      await service.importFromBuffer(Buffer.from(csv));

      const sentEvents = ingestMock.ingestBatch.mock.calls[0][0];
      // Source label do parametro (default) ganha do que veio no CSV
      expect(sentEvents[0].source).toBe('admin-csv-import');
    });

    it('aceita sourceLabel custom', async () => {
      const csv = ['nome,dataInicio', 'Show A,2026-05-10'].join('\n');

      await service.importFromBuffer(Buffer.from(csv), 'admin-special');

      const sentEvents = ingestMock.ingestBatch.mock.calls[0][0];
      expect(sentEvents[0].source).toBe('admin-special');
    });

    it('aceita variações de cabeçalho (name vs nome, etc.)', async () => {
      const csv = [
        'name,startdate,address,lat,lng',
        'Show X,2026-05-10,Rua A,-23.5,-46.6',
      ].join('\n');

      await service.importFromBuffer(Buffer.from(csv));

      const sent = ingestMock.ingestBatch.mock.calls[0][0][0];
      expect(sent.nome).toBe('Show X');
      expect(sent.dataInicio).toBe('2026-05-10');
      expect(sent.enderecoCompleto).toBe('Rua A');
      expect(sent.latitude).toBe(-23.5);
      expect(sent.longitude).toBe(-46.6);
    });

    it('default cidade São Paulo + estado SP quando ausentes', async () => {
      const csv = ['nome,dataInicio', 'Show A,2026-05-10'].join('\n');

      await service.importFromBuffer(Buffer.from(csv));

      const sent = ingestMock.ingestBatch.mock.calls[0][0][0];
      expect(sent.cidade).toBe('São Paulo');
      expect(sent.estado).toBe('SP');
    });

    it('rejeita CSV > 1000 linhas', async () => {
      const header = 'nome,dataInicio';
      const lines = Array.from({ length: 1002 }, (_, i) => `Show ${i},2026-05-10`);
      const csv = [header, ...lines].join('\n');

      await expect(service.importFromBuffer(Buffer.from(csv))).rejects.toThrow(/1000/);
    });
  });
});
