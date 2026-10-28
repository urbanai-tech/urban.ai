import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TERMS_VERSION } from './terms.constants';

export class RegisterDto {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Lucas' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/\S/, { message: 'username precisa conter caracteres visiveis' })
  username: string;

  @ApiProperty({ maxLength: 254, example: 'lucas@email.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: 'Senha em texto puro (trafega so sob TLS; o hash e feito no servidor).',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    example: true,
    description: 'Aceite dos Termos de Uso e da Política de Privacidade (obrigatório, true).',
  })
  @IsBoolean({ message: 'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.' })
  @Equals(true, { message: 'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.' })
  termsAccepted: boolean;

  @ApiProperty({
    example: TERMS_VERSION,
    description: 'Versão vigente dos Termos que o usuário viu (AAAA-MM-DD).',
  })
  @IsString()
  @Equals(TERMS_VERSION, {
    message: 'Os Termos foram atualizados. Recarregue a página e aceite a versão vigente.',
  })
  termsVersion: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  referredBy?: string;
}
