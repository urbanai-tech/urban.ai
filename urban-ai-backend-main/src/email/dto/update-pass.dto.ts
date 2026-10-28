import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

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
    description: 'Nova senha em texto puro (trafega só sob TLS; o hash é feito no servidor).',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  pass: string;
}
