import {
  Equals,
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

  /** Aceite obrigatório dos Termos de Uso e da Política de Privacidade (prova de consentimento). */
  @Equals(true, { message: 'É necessário aceitar os Termos de Uso e a Política de Privacidade' })
  acceptedTerms!: true;

  /** Token do widget Cloudflare Turnstile (obrigatório só quando TURNSTILE_SECRET_KEY está definida). */
  @IsOptional() @IsString() @MaxLength(2048)
  captchaToken?: string;
}

export class UpdateWaitlistNotesDto {
  @ValidateIf((_input, value) => value !== null)
  @IsDefined()
  @IsString()
  @MaxLength(5000)
  notes!: string | null;
}
