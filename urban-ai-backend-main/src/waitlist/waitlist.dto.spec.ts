import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateWaitlistNotesDto, WaitlistSignupDto } from './waitlist.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('waitlist command DTOs', () => {
  it('accepts a bounded signup and explicit notes clearing', async () => {
    await expect(validate(WaitlistSignupDto, {
      email: 'ana@test.com', name: 'Ana', phone: '+55 11 99999-9999', source: 'landing', referredBy: 'friend',
    })).resolves.toBeInstanceOf(WaitlistSignupDto);
    await expect(validate(UpdateWaitlistNotesDto, { notes: null }))
      .resolves.toBeInstanceOf(UpdateWaitlistNotesDto);
  });

  it.each([
    [WaitlistSignupDto, { email: 'invalid' }],
    [WaitlistSignupDto, { email: 'ana@test.com', source: 'x'.repeat(65) }],
    [WaitlistSignupDto, { email: 'ana@test.com', status: 'converted' }],
    [UpdateWaitlistNotesDto, {}],
    [UpdateWaitlistNotesDto, { notes: 42 }],
    [UpdateWaitlistNotesDto, { notes: 'x'.repeat(5001) }],
  ])('rejects malformed, extra and out-of-range fields', async (metatype, input) => {
    await expect(validate(metatype as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
