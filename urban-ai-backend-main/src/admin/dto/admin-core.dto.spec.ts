import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AdminManualOccupancyDto,
  BackfillEventIntelligenceDto,
  RejectEventDedupCandidateDto,
  ScanEventDedupCandidatesDto,
  SetUserActiveDto,
  SetUserRoleDto,
} from './admin-core.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });
const listId = '123e4567-e89b-42d3-a456-426614174000';

describe('admin core runtime DTOs', () => {
  it('preserves supported query-like coercions in admin jobs', async () => {
    await expect(
      validate(ScanEventDedupCandidatesDto, {
        limit: '50',
        lookbackDays: '0',
        lookaheadDays: '365',
        minScore: '0.5',
        highScore: 1,
        includeInactive: 'false',
      }),
    ).resolves.toEqual(expect.objectContaining({ limit: 50, lookbackDays: 0, includeInactive: false }));
    await expect(
      validate(BackfillEventIntelligenceDto, {
        from: '2026-07-15',
        lookaheadDays: '90',
        limit: '25',
        scope: 'in',
        force: '1',
      }),
    ).resolves.toEqual(expect.objectContaining({ lookaheadDays: 90, limit: 25, force: true }));
  });

  it('accepts both supported property identifiers for manual occupancy', async () => {
    const base = { date: '2026-12-31', status: 'booked' as const, revenueCents: '1000', currency: 'BRL' };
    await expect(validate(AdminManualOccupancyDto, { ...base, listId })).resolves.toEqual(
      expect.objectContaining({ revenueCents: 1000, listId }),
    );
    await expect(validate(AdminManualOccupancyDto, { ...base, airbnbListingId: '123456789' })).resolves.toEqual(
      expect.objectContaining({ airbnbListingId: '123456789' }),
    );
    await expect(validate(RejectEventDedupCandidateDto, {})).resolves.toBeInstanceOf(RejectEventDedupCandidateDto);
  });

  it.each([
    [ScanEventDedupCandidatesDto, { limit: 49 }],
    [ScanEventDedupCandidatesDto, { minScore: 1.01 }],
    [ScanEventDedupCandidatesDto, { includeInactive: 'yes' }],
    [ScanEventDedupCandidatesDto, { source: 'urban', admin: true }],
    [RejectEventDedupCandidateDto, { reason: 'x'.repeat(1_001) }],
    [BackfillEventIntelligenceDto, { from: '15/07/2026' }],
    [BackfillEventIntelligenceDto, { limit: 101 }],
    [BackfillEventIntelligenceDto, { force: '' }],
    [AdminManualOccupancyDto, { date: '2026-12-31', status: 'booked' }],
    [AdminManualOccupancyDto, { listId, date: '2026-12-31', status: 'booked', revenueCents: 1.5 }],
    [AdminManualOccupancyDto, { listId, date: '2026-12-31', status: 'booked', currency: 'brl' }],
    [SetUserRoleDto, { role: 'owner' }],
    [SetUserActiveDto, { ativo: 'false' }],
  ])('rejects unknown fields, ambiguous values and out-of-contract boundaries', async (metatype, input) => {
    await expect(validate(metatype as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
