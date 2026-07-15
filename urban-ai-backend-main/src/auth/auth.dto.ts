import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AcceptWaitlistInviteDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/i)
  token!: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Matches(/\S/)
  username?: string;

  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  password!: string;
}

export class GoogleLoginDto {
  @ValidateIf((input: GoogleLoginDto) => !input.credential && !input.token)
  @IsString() @MinLength(1) @MaxLength(8192)
  idToken?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(8192)
  token?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(8192)
  credential?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Matches(/\S/)
  username?: string;

  @IsOptional() @IsEmail() @MaxLength(254)
  email?: string;

  @IsOptional() @IsString() @MinLength(8) @MaxLength(128)
  password?: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) @Matches(/\S/)
  username?: string;

  @IsOptional() @IsEmail() @MaxLength(254)
  email?: string;

  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(128)
  company?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  distanceKm?: number;

  @IsOptional() @IsString() @MaxLength(255)
  airbnbHostId?: string;

  @IsOptional() @IsIn(['conservative', 'balanced', 'aggressive', 'autonomous', 'ai', 'moderate'])
  pricingStrategy?: string;

  @IsOptional() @IsIn(['notifications', 'auto'])
  operationMode?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-100) @Max(1000)
  percentualInicial?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-100) @Max(1000)
  percentualFinal?: number | null;
}
