import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreatePlatformCostDto,
  UpdatePlanPricingDto,
  UpdatePlatformCostDto,
} from './admin-billing.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('admin billing runtime DTOs', () => {
  it('accepts boundaries and preserves supported numeric coercion', async () => {
    await expect(validate(CreatePlatformCostDto, {
      name: 'AB', category: 'infra', recurrence: 'monthly', monthlyCostCents: '100000000',
      percentOfRevenue: '0', scalesWithListings: false,
    })).resolves.toEqual(expect.objectContaining({ monthlyCostCents: 100_000_000, percentOfRevenue: 0 }));
    await expect(validate(UpdatePlanPricingDto, {
      discountAnnualPercent: '100', propertyLimit: '', sortOrder: '', features: ['one'],
    })).resolves.toEqual(expect.objectContaining({
      discountAnnualPercent: 100, propertyLimit: null, sortOrder: 0,
    }));
  });

  it.each([
    [CreatePlatformCostDto, { name: 'Redis', category: 'infra', recurrence: 'monthly', monthlyCostCents: 1, admin: true }],
    [UpdatePlatformCostDto, { active: 'false' }],
    [UpdatePlatformCostDto, { monthlyCostCents: -1 }],
    [UpdatePlanPricingDto, { discountAnnualPercent: 101 }],
    [UpdatePlanPricingDto, { features: Array(51).fill('x') }],
  ])('rejects extra fields, unsafe types and out-of-range values', async (metatype, input) => {
    await expect(validate(metatype as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
