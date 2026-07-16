import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ImportEventsCsvDto, IngestEventsBatchDto } from './events-ingest.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });
const event = {
  nome: 'Festival Urban', dataInicio: '2026-12-31T20:00:00-03:00',
  latitude: '-23.5505', longitude: '-46.6333', source: 'admin-manual',
};

describe('events ingestion runtime DTOs', () => {
  it('validates nested events and bounded CSV labels', async () => {
    await expect(validate(IngestEventsBatchDto, { events: [event] })).resolves.toEqual(
      expect.objectContaining({ events: [expect.objectContaining({ latitude: -23.5505, longitude: -46.6333 })] }),
    );
    await expect(validate(IngestEventsBatchDto, { events: [] })).resolves.toBeInstanceOf(IngestEventsBatchDto);
    await expect(validate(ImportEventsCsvDto, { sourceLabel: 'admin-csv-import' }))
      .resolves.toBeInstanceOf(ImportEventsCsvDto);
  });

  it.each([
    { events: [{ ...event, role: 'admin' }] },
    { events: [{ ...event, latitude: 91 }] },
    { events: [{ ...event, dataInicio: 'tomorrow' }] },
    { events: [{ ...event, linkSiteOficial: 'javascript:alert(1)' }] },
    { events: Array(501).fill(event) },
    { events: [event], unexpected: true },
  ])('rejects nested extras, malformed formats and oversized batches', async (input) => {
    await expect(validate(IngestEventsBatchDto, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
