import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePropertyOwnerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** IDs dos imóveis (addresses) do próprio anfitrião. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  propertyIds: string[];

  @IsOptional()
  @IsBoolean()
  monthlyReportEnabled?: boolean;

  /** Declaração de base legal (obrigatória). */
  @IsBoolean()
  consentAccepted: boolean;

  @IsString()
  @MaxLength(48)
  consentVersion: string;
}

export class UpdatePropertyOwnerDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  /** Trocar o e-mail é trocar o destinatário: exige nova declaração. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  propertyIds?: string[];

  @IsOptional()
  @IsBoolean()
  monthlyReportEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  consentAccepted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  consentVersion?: string;
}

export class CreateOwnerReportLinkDto {
  /** Validade em dias (1 a 90); padrão `OWNER_REPORT_LINK_TTL_DAYS` (30). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  ttlDays?: number;
}
