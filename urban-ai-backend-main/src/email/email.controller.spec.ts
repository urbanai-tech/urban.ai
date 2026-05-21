import { ValidationPipe } from '@nestjs/common';
import { UpdatePass } from './email.controller';

describe('UpdatePass DTO', () => {
  it('keeps reset token and password fields after global whitelist validation', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    const result = await pipe.transform(
      {
        token: 'reset-token',
        pass: 'sha256-password',
        ignored: 'remove-me',
      },
      { type: 'body', metatype: UpdatePass },
    );

    expect(result).toEqual({
      token: 'reset-token',
      pass: 'sha256-password',
    });
  });
});
