import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConnectStaysDto, PreviewStaysPriceDto, PushStaysPriceDto } from './stays.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });
const listingId = '123e4567-e89b-42d3-a456-426614174000';

describe('Stays runtime DTOs', () => {
  it('accepts valid credentials and coerces only numeric price fields', async () => {
    await expect(validate(ConnectStaysDto, {
      clientId: 'client', accessToken: 'token-123', consentAccepted: true, consentVersion: '2026-07',
    })).resolves.toBeInstanceOf(ConnectStaysDto);
    await expect(validate(PushStaysPriceDto, {
      listingId, targetDate: '2026-12-31', newPriceCents: '10000', previousPriceCents: '9000', currency: 'BRL',
    })).resolves.toEqual(expect.objectContaining({ newPriceCents: 10_000, previousPriceCents: 9_000 }));
  });

  it.each([
    [ConnectStaysDto, { clientId: 'client', accessToken: 'token-123', consentAccepted: true, consentVersion: 'v1', role: 'admin' }],
    [ConnectStaysDto, { clientId: 'client', accessToken: 'token-123', consentAccepted: 'true', consentVersion: 'v1' }],
    [PreviewStaysPriceDto, { listingId, targetDate: '31/12/2026', newPriceCents: 100 }],
    [PreviewStaysPriceDto, { listingId: 'not-an-id', targetDate: '2026-12-31', newPriceCents: 100 }],
    [PushStaysPriceDto, { listingId, targetDate: '2026-12-31', newPriceCents: 0, previousPriceCents: 1 }],
  ])('rejects extra, ambiguous and out-of-contract values', async (metatype, input) => {
    await expect(validate(metatype as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
