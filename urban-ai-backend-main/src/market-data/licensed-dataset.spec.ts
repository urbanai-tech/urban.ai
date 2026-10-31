import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { mockQueryBuilder } from './__fixtures__/query-builder-spec';
import { LicensedDatasetImportService } from './licensed-dataset-import.service';
import {
  mapLicensedRow,
  parseDateKey,
  parseLicensedMappingJson,
  resolveLicensedMapping,
} from './licensed-dataset.mapping';

const CSV = fs.readFileSync(path.join(__dirname, '__fixtures__', 'licensed-dataset.sample.csv'), 'utf-8');

describe('mapeamento de colunas do dataset licenciado', () => {
  const header = CSV.split('\n')[0].split(',');

  it('mapeamento padrão casa os cabeçalhos do arquivo de exemplo', () => {
    const mapping = resolveLicensedMapping(header);
    expect(mapping.errors).toEqual([]);
    expect(mapping.columns.externalId).toBe(0);
    expect(mapping.columns.adr).toBe(4);
    expect(mapping.columns.observedDate).toBe(6);
  });

  it('mapeamento do admin renomeia colunas; coluna pedida e ausente é erro', () => {
    const custom = resolveLicensedMapping(['id', 'lat', 'lng', 'diaria_centavos', 'ocup_pct'], {
      externalId: 'id',
      latitude: 'lat',
      longitude: 'lng',
      adr: 'diaria_centavos',
      adrUnit: 'cents',
      occupancy: 'ocup_pct',
      occupancyScale: 'percent',
    });
    expect(custom.errors).toEqual([]);
    const row = mapLicensedRow(['a1', '-23.5', '-46.6', '35050', '64'], custom);
    expect(row.row).toMatchObject({ priceCents: 35050, occupancyRate: 0.64 });

    const broken = resolveLicensedMapping(header, { adr: 'coluna_que_nao_existe' });
    expect(broken.errors.join(' ')).toMatch(/coluna_que_nao_existe/);
  });

  it('campos obrigatórios sem coluna geram erro claro', () => {
    const mapping = resolveLicensedMapping(['foo', 'bar']);
    expect(mapping.errors.join(' ')).toMatch(/externalId/);
    expect(mapping.errors.join(' ')).toMatch(/adr/);
  });

  it('valida o JSON do mapeamento: só campos conhecidos, só texto', () => {
    expect(parseLicensedMappingJson('')).toBeNull();
    expect(parseLicensedMappingJson('{"adr":"preco","adrUnit":"cents"}')).toEqual({ adr: 'preco', adrUnit: 'cents' });
    expect(() => parseLicensedMappingJson('{nao json')).toThrow(/JSON/);
    expect(() => parseLicensedMappingJson('{"hack":"x"}')).toThrow(/desconhecido/);
    expect(() => parseLicensedMappingJson('{"adr":5}')).toThrow(/texto/);
    expect(() => parseLicensedMappingJson('{"adrUnit":"dolar"}')).toThrow(/adrUnit/);
    expect(() => parseLicensedMappingJson('[1]')).toThrow(/objeto/);
  });

  it('linha: converte formatos (pt-BR, centavos, percentual) e normaliza tipologia', () => {
    const mapping = resolveLicensedMapping(header);
    const cells = ['x1', '123456', '-23,5612', '-46.6821', 'R$ 1.234,50', '64', '15/09/2026', 'Vila X', 'Private room', '2', '4'];
    const parsed = mapLicensedRow(cells, mapping);
    expect(parsed.row).toMatchObject({
      latitude: -23.5612,
      priceCents: 123450,
      occupancyRate: 0.64,
      observedOn: '2026-09-15',
      listingType: 'private_room',
      airbnbListingId: '123456',
      bedrooms: 2,
      accommodates: 4,
    });
  });

  it('linhas inválidas são puladas com o motivo', () => {
    const mapping = resolveLicensedMapping(header);
    const reason = (cells: string[]) => mapLicensedRow(cells, mapping).reason;
    expect(reason(['', '1', '-23.5', '-46.6', '300', '0.5', '2026-09-15', '', '', '1', '2'])).toBe('sem id do anúncio');
    expect(reason(['a', '1', '999', '-46.6', '300', '0.5', '2026-09-15', '', '', '1', '2'])).toBe('coordenadas inválidas');
    expect(reason(['a', '1', '0', '0', '300', '0.5', '2026-09-15', '', '', '1', '2'])).toBe('coordenadas inválidas');
    expect(reason(['a', '1', '-23.5', '-46.6', '0', '0.5', '2026-09-15', '', '', '1', '2'])).toBe('diária fora do intervalo plausível');
    expect(reason(['a', '1', '-23.5', '-46.6', '9999999', '0.5', '2026-09-15', '', '', '1', '2'])).toBe('diária fora do intervalo plausível');
    expect(reason(['a', '1', '-23.5', '-46.6', 'abc', '0.5', '2026-09-15', '', '', '1', '2'])).toBe('diária inválida');
    expect(reason(['a', '1', '-23.5', '-46.6', '300', '0.5', 'ontem', '', '', '1', '2'])).toBe('data da observação inválida');
  });

  it('ocupação fora de 0–1 vira nula em vez de entrar errada', () => {
    const mapping = resolveLicensedMapping(header);
    const row = mapLicensedRow(['a', '1', '-23.5', '-46.6', '300', '250', '2026-09-15', '', '', '1', '2'], mapping);
    expect(row.row?.occupancyRate).toBeNull();
  });

  it('datas aceitas', () => {
    expect(parseDateKey('2026-09-15')).toBe('2026-09-15');
    expect(parseDateKey('2026-09-15T10:00:00Z')).toBe('2026-09-15');
    expect(parseDateKey('15/09/2026')).toBe('2026-09-15');
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('')).toBeNull();
  });
});

describe('LicensedDatasetImportService (CSV sintético versionado)', () => {
  function make() {
    const listingQb = mockQueryBuilder();
    const obsQb = mockQueryBuilder();
    const listingRepo: any = {
      createQueryBuilder: jest.fn().mockReturnValue(listingQb),
      find: jest.fn().mockResolvedValue([]),
    };
    const observationRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(obsQb) };
    const logRepo: any = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    return {
      service: new LicensedDatasetImportService(listingRepo, observationRepo, logRepo),
      listingQb,
      obsQb,
      listingRepo,
      logRepo,
    };
  }

  const options = {
    datasetLabel: 'sintetico',
    city: 'sao-paulo',
    license: 'licensed_internal_only' as const,
    collectedAt: '2026-10-01',
    today: '2026-10-31',
  };

  it('importa anúncios e observações, pula as linhas inválidas e registra o lote', async () => {
    const { service, listingQb, obsQb, logRepo } = make();

    const result = await service.importCsv(CSV, { ...options, fileName: 'amostra.csv', importedByUserId: 'admin-1' });

    expect(result).toMatchObject({
      source: 'licensed:sintetico',
      parsed: 27,
      imported: 12,
      skipped: 3,
      observations: 24,
      collectedAt: '2026-10-01',
    });
    expect(result.skippedReasons).toEqual({
      'sem id do anúncio': 1,
      'coordenadas inválidas': 1,
      'diária fora do intervalo plausível': 1,
    });

    // cada anúncio sai com origem, data de coleta (última observação) e licença do lote
    const values = listingQb.values.mock.calls.flatMap((call: any[]) => call[0]);
    expect(values).toHaveLength(12);
    expect(values[0]).toMatchObject({
      source: 'licensed:sintetico',
      license: 'licensed_internal_only',
      city: 'sao-paulo',
      externalId: 'syn-0001',
      airbnbListingId: '9000000001',
      priceCents: 33000, // a observação mais recente vence
      neighborhood: 'Bairro Sintetico A',
      listingType: 'entire_home',
      bedrooms: 1,
      ingestBatchId: result.batchId,
    });
    expect(String(values[0].collectedAt.toISOString())).toContain('2026-09-15');
    expect(listingQb.orUpdate).toHaveBeenCalledWith(expect.arrayContaining(['license', 'collectedAt', 'priceCents']), ['source', 'externalId']);

    const obs = obsQb.values.mock.calls.flatMap((call: any[]) => call[0]);
    expect(obs).toHaveLength(24);
    expect(obs[0]).toMatchObject({ externalListingId: values[0].id, observedOn: '2026-08-15', priceCents: 31000, occupancyRate: 0.72 });
    expect(obsQb.orUpdate).toHaveBeenCalledWith(['priceCents', 'occupancyRate'], ['externalListingId', 'observedOn']);

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'licensed:sintetico',
        license: 'licensed_internal_only',
        rowsImported: 12,
        rowsSkipped: 3,
        observationsImported: 24,
        fileName: 'amostra.csv',
        importedByUserId: 'admin-1',
      }),
    );
  });

  it('é idempotente: reimportar reaproveita o id dos anúncios existentes (atualiza em vez de duplicar)', async () => {
    const { service, listingQb, listingRepo } = make();
    listingRepo.find.mockResolvedValue([{ id: 'existing-uuid', externalId: 'syn-0001' }]);

    await service.importCsv(CSV, options);

    const values = listingQb.values.mock.calls.flatMap((call: any[]) => call[0]);
    expect(values.find((v: any) => v.externalId === 'syn-0001').id).toBe('existing-uuid');
    expect(new Set(values.map((v: any) => v.id)).size).toBe(12);
  });

  it('sem coluna de data não gera observações e usa a data de coleta do lote', async () => {
    const { service, listingQb, obsQb } = make();
    const csv = 'listing_id,latitude,longitude,adr\nz1,-23.5,-46.6,300\nz2,-23.51,-46.61,320\n';

    const result = await service.importCsv(csv, options);

    expect(result.observations).toBe(0);
    expect(obsQb.values).not.toHaveBeenCalled();
    const values = listingQb.values.mock.calls.flatMap((call: any[]) => call[0]);
    expect(String(values[0].collectedAt.toISOString())).toContain('2026-10-01');
  });

  it('valida os metadados do lote (licença obrigatória e restrita, data, rótulo, cidade)', async () => {
    const { service } = make();
    const bad = (patch: any) => service.importCsv(CSV, { ...options, ...patch });
    await expect(bad({ license: 'first_party' })).rejects.toThrow(BadRequestException);
    await expect(bad({ license: 'unknown' })).rejects.toThrow(/license inválida/);
    await expect(bad({ license: undefined })).rejects.toThrow(/license inválida/);
    await expect(bad({ datasetLabel: 'Meu Fornecedor!' })).rejects.toThrow(/datasetLabel/);
    await expect(bad({ city: 'São Paulo' })).rejects.toThrow(/city/);
    await expect(bad({ collectedAt: 'hoje' })).rejects.toThrow(/collectedAt/);
    await expect(bad({ collectedAt: '2027-01-01' })).rejects.toThrow(/futuro/);
  });

  it('arquivo vazio e mapeamento inválido viram 400 sem gravar nada', async () => {
    const { service, listingQb, logRepo } = make();
    await expect(service.importCsv('', options)).rejects.toThrow(/vazio/);
    await expect(service.importCsv('a,b\n1,2\n', options)).rejects.toThrow(/mapeamento inválido/);
    await expect(service.importCsv(CSV, { ...options, mapping: { adr: 'nao_existe' } })).rejects.toThrow(/nao_existe/);
    expect(listingQb.execute).not.toHaveBeenCalled();
    expect(logRepo.save).not.toHaveBeenCalled();
  });

  it('avisa quando nenhuma linha é válida', async () => {
    const { service } = make();
    const result = await service.importCsv('listing_id,latitude,longitude,adr\nz1,999,0,300\n', options);
    expect(result.imported).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/Nenhuma linha válida/);
  });
});
