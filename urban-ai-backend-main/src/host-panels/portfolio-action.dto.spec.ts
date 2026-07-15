import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PortfolioActionDto } from './portfolio-action.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = (value: unknown) => pipe.transform(value, { type: 'body', metatype: PortfolioActionDto });
const propertyId = '123e4567-e89b-42d3-a456-426614174000';

describe('portfolio action runtime DTO', () => {
  it('accepts every supported action shape without stripping payload', async () => {
    await expect(validate({
      propertyIds: [propertyId], action: 'set-date-price', payload: { price: 300, targets: [] },
      dates: ['2026-12-31'], from: '2026-12-01', to: '2026-12-31',
    })).resolves.toEqual(expect.objectContaining({ payload: { price: 300, targets: [] } }));
  });

  it.each([
    { propertyIds: [propertyId], action: 'set-base-price', role: 'admin' },
    { propertyIds: [], action: 'set-base-price' },
    { propertyIds: ['numeric-id'], action: 'set-base-price' },
    { propertyIds: [propertyId], action: 'drop-database' },
    { propertyIds: [propertyId], action: 'set-date-price', dates: ['31/12/2026'] },
    { propertyIds: Array(101).fill(propertyId).map((id, index) => `${id.slice(0, -3)}${String(index).padStart(3, '0')}`), action: 'set-base-price' },
  ])('rejects extras, unsupported commands and invalid boundaries', async (input) => {
    await expect(validate(input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
