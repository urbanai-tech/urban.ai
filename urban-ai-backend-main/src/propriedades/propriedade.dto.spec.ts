import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateAirbnbAlertDto,
  UpdateHostBaselineDto,
  UpdatePropertyIdentityDto,
  UpdatePropertyPricingInputsDto,
  UpsertPropertyManualOccupancyDto,
} from './propriedade.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('property runtime DTOs', () => {
  it('accepts contract boundaries and safely coerces numeric strings', async () => {
    await expect(
      validate(CreateAirbnbAlertDto, {
        latitude: '-23.5505',
        longitude: '-46.6333',
        bedrooms: '2',
        bathrooms: '1.5',
        accommodates: '4',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ latitude: -23.5505, longitude: -46.6333, bedrooms: 2, bathrooms: 1.5 }),
    );
    await expect(
      validate(UpdatePropertyPricingInputsDto, {
        manualDailyPrice: '250,50',
        averageMonthlyRevenue: null,
      }),
    ).resolves.toEqual(expect.objectContaining({ manualDailyPrice: 250.5, averageMonthlyRevenue: null }));
    await expect(
      validate(UpsertPropertyManualOccupancyDto, {
        date: '2026-12-31',
        status: 'booked',
        revenue: '1000,25',
        nightsBooked: '2',
      }),
    ).resolves.toEqual(expect.objectContaining({ revenue: 1000.25, nightsBooked: 2 }));
  });

  it('UpdateHostBaselineDto aceita diária base com opcionais e coage vírgula decimal', async () => {
    await expect(
      validate(UpdateHostBaselineDto, {
        manualDailyPrice: '380,50',
        minDailyPrice: 250,
        weekendDailyPrice: '450',
        quartos: '2',
        banheiros: '1.5',
        hospedes: 4,
        propertyType: 'Apartamento',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ manualDailyPrice: 380.5, weekendDailyPrice: 450, quartos: 2, banheiros: 1.5 }),
    );
  });

  it('UpdateHostBaselineDto aceita diária base com opcionais e coage vírgula decimal', async () => {
    await expect(
      validate(UpdateHostBaselineDto, {
        manualDailyPrice: '380,50',
        minDailyPrice: 250,
        weekendDailyPrice: '450',
        quartos: '2',
        banheiros: '1.5',
        hospedes: 4,
        propertyType: 'Apartamento',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ manualDailyPrice: 380.5, weekendDailyPrice: 450, quartos: 2, banheiros: 1.5 }),
    );
  });

  it.each([
    [CreateAirbnbAlertDto, { latitude: true, longitude: 0, bedrooms: 1, bathrooms: 1, accommodates: 2 }],
    [CreateAirbnbAlertDto, { latitude: -91, longitude: 0, bedrooms: 1, bathrooms: 1, accommodates: 2 }],
    [UpdatePropertyIdentityDto, { internalNickname: 'valid', role: 'admin' }],
    [UpdatePropertyIdentityDto, { internalCode: 'x'.repeat(33) }],
    [UpdatePropertyPricingInputsDto, { manualDailyPrice: '' }],
    [UpdatePropertyPricingInputsDto, { averageMonthlyRevenue: -1 }],
    [UpdateHostBaselineDto, {}],
    [UpdateHostBaselineDto, { manualDailyPrice: 0 }],
    [UpdateHostBaselineDto, { manualDailyPrice: 300, minDailyPrice: -5 }],
    [UpdateHostBaselineDto, { manualDailyPrice: 300, quartos: 1.5 }],
    [UpdateHostBaselineDto, { manualDailyPrice: 300, pricingInputSource: 'airbnb' }],
    [UpdateHostBaselineDto, {}],
    [UpdateHostBaselineDto, { manualDailyPrice: 0 }],
    [UpdateHostBaselineDto, { manualDailyPrice: 300, minDailyPrice: -5 }],
    [UpdateHostBaselineDto, { manualDailyPrice: 300, quartos: 1.5 }],
    [UpdateHostBaselineDto, { manualDailyPrice: 300, pricingInputSource: 'airbnb' }],
    [UpsertPropertyManualOccupancyDto, { date: '31/12/2026', status: 'booked' }],
    [UpsertPropertyManualOccupancyDto, { date: '2026-12-31', status: 'reserved' }],
    [UpsertPropertyManualOccupancyDto, { date: '2026-12-31', nightsBooked: 1.5 }],
  ])('rejects extras, ambiguous coercions and invalid boundaries', async (metatype, input) => {
    await expect(validate(metatype as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
