import { ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ConfirmarEmailWithCodeAndIdDto, EmailController } from './email.controller';
import { UpdatePass } from './dto/update-pass.dto';

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

describe('EmailController confirmation security contract', () => {
  it('accepts only a valid email and an exact six-digit confirmation code', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata = {
      type: 'body' as const,
      metatype: ConfirmarEmailWithCodeAndIdDto,
    };

    await expect(pipe.transform({ email: 'invalid', codigo: '12345' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ email: 'ana@example.com', codigo: '123456' }, metadata)).resolves.toMatchObject({
      email: 'ana@example.com',
      codigo: '123456',
    });
  });

  it('scopes the status lookup to the authenticated account', async () => {
    const emailService = {
      verificarUserEmail: jest.fn().mockResolvedValue({ ativo: true }),
    };
    const controller = new EmailController(emailService as any, {} as any);

    await expect(
      controller.verificarUsuarioState({ email: 'ana@example.com' }, {
        user: { userId: 'user-1' },
      } as any),
    ).resolves.toEqual({ ativo: true });
    expect(emailService.verificarUserEmail).toHaveBeenCalledWith('user-1', 'ana@example.com');
  });

  it('keeps the status endpoint protected by JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, EmailController.prototype.verificarUsuarioState);

    expect(guards).toContain(JwtAuthGuard);
  });
});
