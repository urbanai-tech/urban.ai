import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventsIngestService, IngestEventInput, IngestBatchResponse } from './events-ingest.service';

/**
 * EventsCsvImportService — Camada 3 (curadoria humana).
 *
 * Recebe um buffer de CSV (upload do `/admin/events/import`) e converte
 * cada linha num payload `IngestEventInput`, chama `ingestBatch` do
 * `EventsIngestService` e retorna o resultado.
 *
 * Schema de CSV esperado (cabeçalho na 1ª linha):
 *   nome (obrigatório)
 *   dataInicio (obrigatório, ISO 8601 ou YYYY-MM-DD)
 *   dataFim (opcional)
 *   enderecoCompleto (recomendado)
 *   cidade, estado (default São Paulo / SP)
 *   latitude, longitude (opcional — geocoding lazy)
 *   categoria
 *   venueType (stadium/convention_center/theater/arena/park/other)
 *   venueCapacity, expectedAttendance (números)
 *   linkSiteOficial, imagemUrl
 *   descricao
 *   sourceId
 *
 * Cabeçalhos extras são ignorados. Cabeçalhos faltando: lat/lng → marca
 * pendingGeocode (precisa endereço); nome ou data faltando → linha skipada
 * com motivo.
 *
 * Source forçado a `admin-csv-import` (sobrescreve qualquer source no CSV
 * pra evitar spoofing).
 */
@Injectable()
export class EventsCsvImportService {
  private readonly logger = new Logger(EventsCsvImportService.name);
  private readonly MAX_ROWS = 1000;
  private readonly MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
  private readonly DEFAULT_SOURCE = 'admin-csv-import';

  constructor(private readonly ingestService: EventsIngestService) {}

  /**
   * Parseia CSV (UTF-8) e ingere. Retorna estatísticas.
   *
   * @param buffer Conteúdo do arquivo CSV (do multer)
   * @param sourceLabel Override do source (default 'admin-csv-import')
   */
  async importFromBuffer(
    buffer: Buffer,
    sourceLabel?: string,
  ): Promise<{
    parsedRows: number;
    invalidRows: Array<{ line: number; reason: string }>;
    ingest: IngestBatchResponse;
  }> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('arquivo CSV vazio');
    }
    if (buffer.length > this.MAX_FILE_BYTES) {
      throw new BadRequestException(`arquivo > ${this.MAX_FILE_BYTES / 1024 / 1024}MB`);
    }

    const text = buffer.toString('utf-8');
    const rows = this.parseCsv(text);
    if (rows.length < 2) {
      throw new BadRequestException(
        'CSV precisa ter pelo menos cabeçalho + 1 linha de dados',
      );
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    if (dataRows.length > this.MAX_ROWS) {
      throw new BadRequestException(
        `máximo de ${this.MAX_ROWS} linhas por upload — divida em arquivos menores`,
      );
    }

    const events: IngestEventInput[] = [];
    const invalidRows: Array<{ line: number; reason: string }> = [];

    const source = sourceLabel?.trim() || this.DEFAULT_SOURCE;

    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i];
      if (this.isEmptyRow(cells)) continue;

      try {
        const payload = this.cellsToPayload(header, cells, source);
        if (!payload) {
          invalidRows.push({ line: i + 2, reason: 'nome ou dataInicio ausentes' });
          continue;
        }
        events.push(payload);
      } catch (err: any) {
        invalidRows.push({ line: i + 2, reason: err?.message ?? 'erro ao parsear' });
      }
    }

    if (events.length === 0) {
      return {
        parsedRows: dataRows.length,
        invalidRows,
        ingest: {
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          bySource: {},
          results: [],
        },
      };
    }

    const ingest = await this.ingestService.ingestBatch(events);
    this.logger.log(
      `CSV import: parsed=${dataRows.length}, sent=${events.length}, ` +
        `created=${ingest.created}, updated=${ingest.updated}, ` +
        `skipped=${ingest.skipped}, invalidRows=${invalidRows.length}`,
    );

    return { parsedRows: dataRows.length, invalidRows, ingest };
  }

  // ============== Helpers ==============

  /**
   * Parser de CSV pequeno e tolerante:
   *  - separador `,`
   *  - célula com vírgula precisa estar entre aspas duplas
   *  - aspas duplas dentro de célula = `""`
   *  - quebras de linha CRLF/LF
   *  - linhas vazias são preservadas (filtradas em isEmptyRow)
   */
  parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        cell += ch;
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        row.push(cell);
        cell = '';
        i++;
        continue;
      }
      if (ch === '\r') {
        i++;
        continue;
      }
      if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        i++;
        continue;
      }
      cell += ch;
      i++;
    }

    // Última célula/linha (caso sem newline final)
    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }

    return rows;
  }

  private isEmptyRow(cells: string[]): boolean {
    return cells.every((c) => !c || !c.trim());
  }

  private cellsToPayload(
    header: string[],
    cells: string[],
    source: string,
  ): IngestEventInput | null {
    const get = (...names: string[]): string => {
      for (const name of names) {
        const idx = header.indexOf(name.toLowerCase());
        if (idx >= 0 && cells[idx] !== undefined) {
          return cells[idx].trim();
        }
      }
      return '';
    };

    const nome = get('nome', 'name');
    const dataInicio = get('datainicio', 'data_inicio', 'startdate');
    if (!nome || !dataInicio) return null;

    const payload: IngestEventInput = {
      nome,
      dataInicio,
      source,
    };

    const dataFim = get('datafim', 'data_fim', 'enddate');
    if (dataFim) payload.dataFim = dataFim;

    const endereco = get('enderecocompleto', 'endereco', 'address');
    if (endereco) payload.enderecoCompleto = endereco;

    const cidade = get('cidade', 'city');
    if (cidade) payload.cidade = cidade;
    else payload.cidade = 'São Paulo';

    const estado = get('estado', 'state', 'uf');
    payload.estado = (estado || 'SP').slice(0, 2).toUpperCase();

    const lat = this.toNumberOrNull(get('latitude', 'lat'));
    const lng = this.toNumberOrNull(get('longitude', 'lng', 'lon'));
    if (lat !== null && lng !== null) {
      payload.latitude = lat;
      payload.longitude = lng;
    }

    const categoria = get('categoria', 'category');
    if (categoria) payload.categoria = categoria;

    const venueType = get('venuetype', 'venue_type');
    if (venueType) payload.venueType = venueType;

    const venueCapacity = this.toIntOrNull(get('venuecapacity', 'venue_capacity'));
    if (venueCapacity !== null) payload.venueCapacity = venueCapacity;

    const expected = this.toIntOrNull(get('expectedattendance', 'expected_attendance'));
    if (expected !== null) payload.expectedAttendance = expected;

    const link = get('linksiteoficial', 'link', 'url', 'website');
    if (link) payload.linkSiteOficial = link;

    const img = get('imagemurl', 'imagem_url', 'image_url', 'imagem');
    if (img) payload.imagemUrl = img;

    const descricao = get('descricao', 'description', 'desc');
    if (descricao) payload.descricao = descricao;

    const sourceId = get('sourceid', 'source_id');
    if (sourceId) payload.sourceId = sourceId;

    return payload;
  }

  private toNumberOrNull(s: string): number | null {
    if (!s) return null;
    const cleaned = s.replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  private toIntOrNull(s: string): number | null {
    if (!s) return null;
    const cleaned = s.replace(/\D/g, '');
    if (!cleaned) return null;
    return parseInt(cleaned, 10);
  }
}
