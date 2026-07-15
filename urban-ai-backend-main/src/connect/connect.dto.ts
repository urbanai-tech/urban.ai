import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class RegisterPropertyDto {
  @IsOptional() @Transform(({ value }) => String(value)) @IsString() @MaxLength(128)
  id?: string;

  @IsString() @MinLength(1) @MaxLength(255)
  titulo!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  id_do_anuncio!: string;

  @IsOptional() @IsString() @MaxLength(2048)
  pictureUrl?: string;

  @IsBoolean()
  ativo!: boolean;

  // Campos retornados pela descoberta do host e enviados pelo modal legado.
  @IsOptional() @IsString() @MaxLength(128) api_id?: string;
  @IsOptional() @IsString() @MaxLength(255) host_name?: string;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000_000) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) bedrooms?: number;
  @IsOptional() @IsString() @MaxLength(64) last_updated?: string;
}

export class RegisterPropertiesDto extends Array<RegisterPropertyDto> {}

export class AddressListingReferenceDto {
  @IsString() @MinLength(1) @MaxLength(128)
  id!: string;
}

export class CreateAddressInputDto {
  @IsOptional() @ValidateIf((_input, value) => value !== null)
  @IsString() @Matches(/^\d{5}-?\d{3}$/)
  cep?: string | null;

  @IsOptional() @ValidateIf((_input, value) => value !== null)
  @IsString() @MaxLength(20)
  numero?: string | null;

  @IsOptional() @ValidateIf((_input, value) => value !== null)
  @IsString() @MaxLength(255)
  logradouro?: string | null;

  @IsOptional() @ValidateIf((_input, value) => value !== null)
  @IsString() @MaxLength(120)
  bairro?: string | null;

  @IsOptional() @ValidateIf((_input, value) => value !== null)
  @IsString() @MaxLength(120)
  cidade?: string | null;

  @IsOptional() @ValidateIf((_input, value) => value !== null)
  @IsString() @Matches(/^[A-Za-z]{2}$/)
  estado?: string | null;

  @ValidateNested() @Type(() => AddressListingReferenceDto)
  list!: AddressListingReferenceDto;
}

export class CreateAddressesDto extends Array<CreateAddressInputDto> {}
