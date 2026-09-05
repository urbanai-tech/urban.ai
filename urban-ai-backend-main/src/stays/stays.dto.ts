import { Type } from 'class-transformer';
import {
  Equals,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export class ConnectStaysDto {
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(255)
  apiBaseUrl?: string;

  @IsString() @MinLength(1) @MaxLength(128)
  clientId!: string;

  // Historical API field name; holds the Stays Client Secret, encrypted at rest.
  @IsString() @MinLength(8) @MaxLength(1024)
  accessToken!: string;

  @Equals(true)
  consentAccepted!: boolean;

  @IsString() @MinLength(1) @MaxLength(64)
  consentVersion!: string;
}

export class PreviewStaysPriceDto {
  @IsOptional() @IsUUID()
  requestId?: string;

  @IsUUID()
  listingId!: string;

  @IsString() @Matches(DATE_ONLY)
  targetDate!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(2_147_483_647)
  newPriceCents!: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647)
  previousPriceCents?: number | null;

  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional() @IsUUID()
  analisePrecoId?: string;
}

export class PushStaysPriceDto {
  @IsOptional() @IsUUID()
  requestId?: string;

  @IsUUID()
  listingId!: string;

  @IsString() @Matches(DATE_ONLY)
  targetDate!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(2_147_483_647)
  newPriceCents!: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(2_147_483_647)
  previousPriceCents!: number;

  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional() @IsUUID()
  analisePrecoId?: string;
}
