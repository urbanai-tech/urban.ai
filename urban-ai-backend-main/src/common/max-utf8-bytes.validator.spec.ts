import { plainToInstance } from 'class-transformer';
import { IsString, validate } from 'class-validator';
import { MaxUtf8Bytes } from './max-utf8-bytes.validator';
import { RegisterDto } from '../auth/register.dto';
import { AcceptWaitlistInviteDto, LoginDto, UpdateUserDto } from '../auth/auth.dto';
import { UpdatePass } from '../email/dto/update-pass.dto';
import { PASSWORD_TOO_LONG_MESSAGE } from '../auth/password-hashing';
import { TERMS_VERSION } from '../auth/terms.constants';

class Sample {
  @IsString() @MaxUtf8Bytes(4)
  value!: string;
}

const AT_72 = 'á'.repeat(36); // 36 caracteres, 72 bytes
const AT_73 = `${AT_72}a`; // 37 caracteres (passa no MaxLength 128), 73 bytes

async function messagesFor<T extends object>(cls: new () => T, plain: Record<string, unknown>, field: string) {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.filter((e) => e.property === field).flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('MaxUtf8Bytes', () => {
  it('counts UTF-8 bytes, not characters', async () => {
    expect(await validate(plainToInstance(Sample, { value: 'abcd' }))).toHaveLength(0);
    const errors = await validate(plainToInstance(Sample, { value: 'ábc' })); // 3 chars, 4 bytes
    expect(errors).toHaveLength(0);
    const tooLong = await validate(plainToInstance(Sample, { value: 'ááa' })); // 3 chars, 5 bytes
    expect(tooLong[0].constraints).toHaveProperty('maxUtf8Bytes');
  });

  describe('campos que DEFINEM senha recusam > 72 bytes com mensagem em pt-BR', () => {
    const cases: Array<[string, new () => object, Record<string, unknown>, string]> = [
      ['cadastro', RegisterDto, { username: 'Ana', email: 'a@test.com', termsAccepted: true, termsVersion: TERMS_VERSION }, 'password'],
      ['convite da waitlist', AcceptWaitlistInviteDto, { token: 'a'.repeat(64) }, 'password'],
      ['admin (atualizar usuário)', UpdateUserDto, {}, 'password'],
      ['redefinição', UpdatePass, { token: 'reset-token' }, 'pass'],
    ];

    it.each(cases)('%s', async (_name, cls, base, field) => {
      expect(await messagesFor(cls, { ...base, [field]: AT_72 }, field)).toEqual([]);
      expect(await messagesFor(cls, { ...base, [field]: AT_73 }, field)).toEqual([PASSWORD_TOO_LONG_MESSAGE]);
      // A regra de tamanho mínimo continua valendo.
      expect((await messagesFor(cls, { ...base, [field]: 'curta' }, field)).length).toBeGreaterThan(0);
    });
  });

  it('o login NÃO limita bytes: senhas legadas longas precisam continuar entrando', async () => {
    expect(await messagesFor(LoginDto, { email: 'a@test.com', password: AT_73 }, 'password')).toEqual([]);
  });
});
