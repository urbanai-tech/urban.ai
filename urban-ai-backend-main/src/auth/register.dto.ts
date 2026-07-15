import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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
    description: 'Senha em texto puro ou pre-hash SHA-256 legado.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

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
