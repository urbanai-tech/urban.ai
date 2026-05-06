import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsIngestService } from './events-ingest.service';
import { CoverageService } from './coverage.service';
import { Event } from '../entities/events.entity';

/**
 * Tests do serviço de ingestão de eventos (F6.2 Plus).
 *
 * Foco principal: idempotência via dedupHash + validação + UPSERT conservador
 * (não sobrescreve campos enriquecidos pela IA) + filtro de cobertura.
 */

type MockRepo = Partial<Record<keyof Repository<Event>, jest.Mock>>;

const mockRepo = (): MockRepo => ({
  findOne: jest.fn(),
  create: jest.fn((row) => row),
  save: jest.fn((row) => Promise.resolve({ id: 'gen-id', ...row })),
  update: jest.fn(),
});

describe('EventsIngestService', () => {
  let service: EventsIngestService;
  let repo: MockRepo;
  let coverageMock: { isWithinCoverage: jest.Mock };

  beforeEach(async () => {
    repo = mockRepo();
    // Default: tudo é considerado dentro da cobertura (não muda comportamento
    // dos tests legados). Cada test pode override via coverageMock.isWithinCoverage.
    coverageMock = { isWithinCoverage: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsIngestService,
        { provide: getRepositoryToken(Event), useValue: repo },
        { provide: CoverageService, useValue: coverageMock },
      ],
    }).compile();

    service = module.get(EventsIngestService);
  });

  describe('computeDedupHash', () => {
    it('produz mesmo hash para mesmo evento', () => {
      const a = service.computeDedupHash(
        'Palmeiras x Santos',
        new Date('2026-05-10T16:00:00Z'),
        -23.5275,
        -46.6783,
      );
      const b = service.computeDedupHash(
        'Palmeiras x Santos',
        new Date('2026-05-10T18:00:00Z'), // hora diferente, mesmo dia
        -23.5275,
        -46.6783,
      );
      expect(a).toBe(b); // hora não importa, só dia
    });

    it('absorve variações pequenas de lat/lng (~100m)', () => {
      const a = service.computeDedupHash(
        'Show X',
        new Date('2026-05-10T20:00:00Z'),
        -23.5275123,
        -46.6783456,
      );
      const b = service.computeDedupHash(
        'Show X',
        new Date('2026-05-10T20:00:00Z'),
        -23.5275999, // diff < 0.001 → arredonda igual
        -46.6783999,
      );
      expect(a).toBe(b);
    });

    it('normaliza espaços e caixa do nome', () => {
      const a = service.computeDedupHash(
        'PALMEIRAS X SANTOS  ',
        new Date('2026-05-10'),
        -23.5275,
        -46.6783,
      );
      const b = service.computeDedupHash(
        '  palmeiras x santos',
        new Date('2026-05-10'),
        -23.5275,
        -46.6783,
      );
      expect(a).toBe(b);
    });

    it('hashes diferentes para datas diferentes', () => {
      const a = service.computeDedupHash('Show X', new Date('2026-05-10'), 0, 0);
      const b = service.computeDedupHash('Show X', new Date('2026-05-11'), 0, 0);
      expect(a).not.toBe(b);
    });
  });

  describe('ingestOne — validação', () => {
    const validBase = {
      nome: 'Palmeiras x Santos',
      dataInicio: '2026-05-10T16:00:00Z',
      latitude: -23.5275,
      longitude: -46.6783,
      source: 'api-football',
    };

    it('skipped quando nome ausente', async () => {
      const r = await service.ingestOne({ ...validBase, nome: '' });
      expect(r.status).toBe('skipped');
      expect(r.reason).toMatch(/nome/);
    });

    it('skipped quando dataInicio inválida', async () => {
      const r = await service.ingestOne({ ...validBase, dataInicio: 'not-a-date' });
      expect(r.status).toBe('skipped');
      expect(r.reason).toMatch(/dataInicio/);
    });

    it('skipped quando lat fora de [-90, 90]', async () => {
      const r = await service.ingestOne({ ...validBase, latitude: 95 });
      expect(r.status).toBe('skipped');
      expect(r.reason).toMatch(/latitude/);
    });

    it('aceita sem lat/lng quando enderecoCompleto presente (geocoding lazy)', async () => {
      repo.findOne!.mockResolvedValue(null);
      const r = await service.ingestOne({
        ...validBase,
        latitude: null,
        longitude: null,
        enderecoCompleto: 'Allianz Parque, São Paulo',
      });
      expect(r.status).toBe('created');
      const saved = repo.save!.mock.calls[0][0];
      expect(saved.pendingGeocode).toBe(true);
      expect(saved.ativo).toBe(false);
      expect(saved.latitude).toBeNull();
    });

    it('skipped quando sem lat/lng E sem endereço (lixo)', async () => {
      const r = await service.ingestOne({
        ...validBase,
        latitude: null,
        longitude: null,
        enderecoCompleto: '',
      });
      expect(r.status).toBe('skipped');
      expect(r.reason).toMatch(/geocodificar|endere/i);
    });

    it('skipped quando source ausente', async () => {
      const r = await service.ingestOne({ ...validBase, source: '' });
      expect(r.status).toBe('skipped');
      expect(r.reason).toMatch(/source/);
    });
  });

  describe('ingestOne — created/updated', () => {
    it('cria novo quando dedupHash não existe', async () => {
      repo.findOne!.mockResolvedValue(null);

      const r = await service.ingestOne({
        nome: 'Palmeiras x Santos',
        dataInicio: '2026-05-10T16:00:00Z',
        latitude: -23.5275,
        longitude: -46.6783,
        source: 'api-football',
        sourceId: 'fixture-12345',
        venueCapacity: 43000,
        venueType: 'stadium',
      });

      expect(r.status).toBe('created');
      expect(repo.save).toHaveBeenCalled();
      const saved = repo.save!.mock.calls[0][0];
      expect(saved.source).toBe('api-football');
      expect(saved.venueType).toBe('stadium');
      expect(saved.venueCapacity).toBe(43000);
      expect(saved.dedupHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('faz update conservador quando dedupHash já existe', async () => {
      repo.findOne!.mockResolvedValue({
        id: 'existing-id',
        nome: 'Palmeiras x Santos',
        descricao: null,            // vazio → será preenchido
        categoria: 'esporte',       // já tem → preserva
        relevancia: 85,             // IA já calculou → preserva
        venueCapacity: null,        // vazio → preenchido pelo coletor novo
        venueType: 'stadium',       // já tem → preserva
      });

      const r = await service.ingestOne({
        nome: 'Palmeiras x Santos',
        dataInicio: '2026-05-10T16:00:00Z',
        latitude: -23.5275,
        longitude: -46.6783,
        source: 'sympla-api',           // outra fonte reportando o mesmo evento
        descricao: 'Jogo do Brasileirão',
        categoria: 'show',              // tentaria sobrescrever 'esporte', mas não deve
        venueCapacity: 43000,
        venueType: 'convention_center', // tentaria sobrescrever 'stadium', não deve
      });

      expect(r.status).toBe('updated');
      expect(repo.update).toHaveBeenCalled();
      const patch = repo.update!.mock.calls[0][1];
      expect(patch.descricao).toBe('Jogo do Brasileirão');  // estava vazio, preenche
      expect(patch.venueCapacity).toBe(43000);              // estava vazio, preenche
      // Não atualiza campos que já tinham valor:
      expect(patch.categoria).toBeUndefined();
      expect(patch.venueType).toBeUndefined();
      expect(patch.relevancia).toBeUndefined();
    });

    it('skipped não bate no repo quando inválido', async () => {
      const r = await service.ingestOne({
        nome: 'X',
        dataInicio: '2026-05-10T00:00:00Z',
        latitude: 0,
        longitude: 0,
        source: 'api-football',
      });
      expect(r.status).toBe('skipped');
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('cobertura geográfica', () => {
    it('marca outOfScope=true e ativo=false quando geo está fora da cobertura', async () => {
      coverageMock.isWithinCoverage.mockResolvedValue(false);
      repo.findOne!.mockResolvedValue(null);

      await service.ingestOne({
        nome: 'Show no Rio',
        dataInicio: '2026-05-10T20:00:00Z',
        latitude: -22.9,
        longitude: -43.2,
        source: 'serpapi',
      });

      const saved = repo.save!.mock.calls[0][0];
      expect(saved.outOfScope).toBe(true);
      expect(saved.ativo).toBe(false);
    });

    it('marca outOfScope=false e ativo=true quando dentro da cobertura', async () => {
      coverageMock.isWithinCoverage.mockResolvedValue(true);
      repo.findOne!.mockResolvedValue(null);

      await service.ingestOne({
        nome: 'Show em SP',
        dataInicio: '2026-05-10T20:00:00Z',
        latitude: -23.5275,
        longitude: -46.6783,
        source: 'serpapi',
      });

      const saved = repo.save!.mock.calls[0][0];
      expect(saved.outOfScope).toBe(false);
      expect(saved.ativo).toBe(true);
    });

    it('quando sem geo, NÃO chama coverage (geocoder cron resolve depois)', async () => {
      repo.findOne!.mockResolvedValue(null);

      await service.ingestOne({
        nome: 'Show TBD',
        dataInicio: '2026-05-10T20:00:00Z',
        enderecoCompleto: 'Local em São Paulo',
        source: 'serpapi',
      });

      expect(coverageMock.isWithinCoverage).not.toHaveBeenCalled();
      const saved = repo.save!.mock.calls[0][0];
      expect(saved.pendingGeocode).toBe(true);
      expect(saved.outOfScope).toBe(false);
      expect(saved.ativo).toBe(false);
    });
  });

  describe('ingestBatch', () => {
    it('processa lote misto e agrega bySource', async () => {
      // Primeiro create, segundo update, terceiro skipped
      repo.findOne!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'e2', descricao: null, relevancia: 90 });

      const items = [
        {
          nome: 'Jogo A',
          dataInicio: '2026-05-10T20:00:00Z',
          latitude: -23.5,
          longitude: -46.6,
          source: 'api-football',
          venueType: 'stadium',
        },
        {
          nome: 'Jogo B',
          dataInicio: '2026-05-11T20:00:00Z',
          latitude: -23.6,
          longitude: -46.7,
          source: 'api-football',
        },
        // Inválido
        {
          nome: '',
          dataInicio: '2026-05-12',
          latitude: 0,
          longitude: 0,
          source: 'api-football',
        },
      ];

      const r = await service.ingestBatch(items);

      expect(r.total).toBe(3);
      expect(r.created).toBe(1);
      expect(r.updated).toBe(1);
      expect(r.skipped).toBe(1);
      expect(r.bySource['api-football']).toEqual({
        created: 1,
        updated: 1,
        skipped: 1,
      });
      expect(r.results).toHaveLength(3);
    });

    it('rejeita batch > 500', async () => {
      const items = Array.from({ length: 501 }, () => ({
        nome: 'x',
        dataInicio: new Date(),
        latitude: 0,
        longitude: 0,
        source: 'a',
      }));
      await expect(service.ingestBatch(items)).rejects.toThrow(/500/);
    });

    it('aceita batch vazio', async () => {
      const r = await service.ingestBatch([]);
      expect(r.total).toBe(0);
      expect(r.results).toHaveLength(0);
    });
  });
});
