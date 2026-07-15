import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AcceptWaitlistInviteDto,
  GoogleLoginDto,
  LoginDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './auth.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('auth command DTOs', () => {
  it('accepts every supported auth command shape and safe numeric coercion', async () => {
    await expect(validate(AcceptWaitlistInviteDto, {
      token: 'a'.repeat(64), username: 'Ana', password: 'Senha123!',
    })).resolves.toBeInstanceOf(AcceptWaitlistInviteDto);
    await expect(validate(LoginDto, { email: 'ana@test.com', password: 'legacy' }))
      .resolves.toBeInstanceOf(LoginDto);
    await expect(validate(GoogleLoginDto, { credential: 'google-token' }))
      .resolves.toBeInstanceOf(GoogleLoginDto);
    await expect(validate(UpdateUserDto, {})).resolves.toBeInstanceOf(UpdateUserDto);
    await expect(validate(UpdateProfileDto, {
      distanceKm: '500', pricingStrategy: 'autonomous', operationMode: 'auto',
      percentualInicial: '-100', percentualFinal: null,
    })).resolves.toEqual(expect.objectContaining({ distanceKm: 500, percentualInicial: -100 }));
  });

  it.each([
    [AcceptWaitlistInviteDto, { token: 'short', password: 'Senha123!' }],
    [AcceptWaitlistInviteDto, { token: 'a'.repeat(64), password: 'Senha123!', role: 'admin' }],
    [LoginDto, { email: 'not-email', password: 'legacy' }],
    [LoginDto, { email: 'ana@test.com', password: 12345678 }],
    [GoogleLoginDto, {}],
    [GoogleLoginDto, { token: 123 }],
    [UpdateUserDto, { username: 'A' }],
    [UpdateProfileDto, { distanceKm: 501 }],
    [UpdateProfileDto, { pricingStrategy: 'drop-table' }],
    [UpdateProfileDto, { operationMode: 'root', role: 'admin' }],
  ])('rejects unknown properties, unsafe types and boundary violations', async (metatype, input) => {
    await expect(validate(metatype as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
