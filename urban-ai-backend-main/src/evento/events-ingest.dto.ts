import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IngestEventDto {
  @IsString() @MinLength(2) @MaxLength(255)
  nome!: string;

  @IsISO8601({ strict: true })
  dataInicio!: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  latitude?: number | null;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  longitude?: number | null;

  @IsOptional() @IsISO8601({ strict: true })
  dataFim?: string | null;

  @IsOptional() @IsString() @MaxLength(1000)
  enderecoCompleto?: string;

  @IsOptional() @IsString() @MaxLength(120)
  cidade?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(2)
  estado?: string;

  @IsOptional() @IsString() @MaxLength(10_000)
  descricao?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  categoria?: string | null;

  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048)
  linkSiteOficial?: string | null;

  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048)
  imagemUrl?: string | null;

  @IsString() @MinLength(1) @MaxLength(128)
  source!: string;

  @IsOptional() @IsString() @MaxLength(255)
  sourceId?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000)
  venueCapacity?: number | null;

  @IsOptional() @IsString() @MaxLength(100)
  venueType?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000)
  expectedAttendance?: number | null;

  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2048)
  crawledUrl?: string | null;
}

export class IngestEventsBatchDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}

export class ImportEventsCsvDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128)
  sourceLabel?: string;
}
