import { Type } from 'class-transformer';
import {
  Equals,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export class ConnectStaysDto {
  /**
   * Identificador da conta Stays (subdomínio de `<conta>.stays.net`). Nunca URL:
   * o destino é montado no servidor (SSRF). Opcional enquanto o piloto usa
   * STAYS_API_BASE_URL do ambiente.
   */
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]{1,63}$/)
  accountSlug?: string;

  @IsString() @MinLength(1) @MaxLength(128)
  clientId!: string;

  // Nome histórico do campo; contém o Client Secret da API Stays, cifrado em repouso.
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

  /**
   * Opcional e NÃO confiável: o servidor lê o preço vigente na Stays. Se enviado e
   * diferente do vigente, o push é recusado com 409 (a tela estava desatualizada).
   */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2_147_483_647)
  previousPriceCents?: number;

  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional() @IsUUID()
  analisePrecoId?: string;
}

export class LinkStaysListingDto {
  /** Imóvel Urban (List) do próprio usuário. Desvincular é DELETE. */
  @IsUUID()
  propriedadeId!: string;
}

export class ListPriceUpdatesQueryDto {
  @IsOptional() @IsUUID()
  listingId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
