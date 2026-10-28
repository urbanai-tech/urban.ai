import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MaxUtf8Bytes } from 'src/common/max-utf8-bytes.validator';
import { BCRYPT_MAX_PASSWORD_BYTES, PASSWORD_TOO_LONG_MESSAGE } from 'src/auth/password-hashing';

export class UpdatePass {
  @ApiProperty({
    example: 'Df90Cz...reset-token',
    description: 'Token de redefinição enviado por e-mail',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'NovaSenha#2026',
    description: 'Ate 72 bytes UTF-8 (limite do bcrypt). Nova senha em texto puro (trafega só sob TLS; o hash é feito no servidor).',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @MaxUtf8Bytes(BCRYPT_MAX_PASSWORD_BYTES, { message: PASSWORD_TOO_LONG_MESSAGE })
  pass: string;
}
