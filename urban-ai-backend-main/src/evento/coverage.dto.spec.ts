import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CheckCoverageDto, CreateCoverageRegionDto, UpdateCoverageRegionDto } from './coverage.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('coverage runtime DTOs', () => {
  it('accepts circle and bounding-box contracts and transforms numeric strings', async () => {
    await expect(
      validate(CreateCoverageRegionDto, {
        name: 'Grande São Paulo',
        status: 'active',
        centerLat: '-23.5505',
        centerLng: '-46.6333',
        radiusKm: '80',
        notes: null,
      }),
    ).resolves.toMatchObject({
      centerLat: -23.5505,
      centerLng: -46.6333,
      radiusKm: 80,
    });

    await expect(
      validate(CreateCoverageRegionDto, {
        name: 'Cobertura global de borda',
        minLat: -90,
        maxLat: 90,
        minLng: -180,
        maxLng: 180,
      }),
    ).resolves.toBeInstanceOf(CreateCoverageRegionDto);
  });

  it('accepts partial updates, explicit nulls and coordinate boundary checks', async () => {
    await expect(
      validate(UpdateCoverageRegionDto, { status: 'inactive', centerLat: null }),
    ).resolves.toMatchObject({ status: 'inactive', centerLat: null });
    await expect(
      validate(CheckCoverageDto, { latitude: '-90', longitude: '180' }),
    ).resolves.toMatchObject({ latitude: -90, longitude: 180 });
  });

  it.each([
    { name: 'A', centerLat: 0, centerLng: 0, radiusKm: 1 },
    { name: 'Valid name', status: 'pending', centerLat: 0, centerLng: 0, radiusKm: 1 },
    { name: 'Valid name', centerLat: 91, centerLng: 0, radiusKm: 1 },
    { name: 'Valid name', centerLat: 0, centerLng: -181, radiusKm: 1 },
    { name: 'Valid name', centerLat: 0, centerLng: 0, radiusKm: 0 },
    { name: 'Valid name', centerLat: {}, centerLng: 0, radiusKm: 1 },
    { name: 'Valid name', centerLat: 0, centerLng: 0, radiusKm: 1, admin: true },
    { name: 'x'.repeat(129), centerLat: 0, centerLng: 0, radiusKm: 1 },
    { name: 'Valid name', centerLat: 0, centerLng: 0, radiusKm: 1, notes: 'x'.repeat(5001) },
  ])('rejects malformed, oversized, nested and extra create fields', async (input) => {
    await expect(validate(CreateCoverageRegionDto, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    { latitude: 90.00000001, longitude: 0 },
    { latitude: 0, longitude: -180.00000001 },
    { latitude: 'north', longitude: 0 },
    { latitude: 0 },
    { latitude: 0, longitude: 0, nested: { role: 'admin' } },
  ])('rejects malformed coordinate checks and unknown nested input', async (input) => {
    await expect(validate(CheckCoverageDto, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
