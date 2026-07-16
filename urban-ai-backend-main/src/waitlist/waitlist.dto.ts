import {
  IsDefined,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class WaitlistSignupDto {
  @IsEmail() @MaxLength(254)
  email!: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(64)
  source?: string;

  @IsOptional() @IsString() @MaxLength(128)
  referredBy?: string;
}

export class UpdateWaitlistNotesDto {
  @ValidateIf((_input, value) => value !== null)
  @IsDefined()
  @IsString()
  @MaxLength(5000)
  notes!: string | null;
}
