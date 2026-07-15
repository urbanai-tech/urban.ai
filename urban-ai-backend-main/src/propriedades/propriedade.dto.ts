import { Transform } from 'class-transformer';
import {
  IsIn,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const DECIMAL = /^-?(?:\d+|\d*[.,]\d+)$/;

const safeNumber = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return DECIMAL.test(normalized) ? Number(normalized.replace(',', '.')) : value;
};

export class CreateAirbnbAlertDto {
  @Transform(safeNumber) @IsNumber() @Min(-90) @Max(90)
  latitude!: number;

  @Transform(safeNumber) @IsNumber() @Min(-180) @Max(180)
  longitude!: number;

  @Transform(safeNumber) @IsInt() @Min(0) @Max(100)
  bedrooms!: number;

  @Transform(safeNumber) @IsNumber() @Min(0) @Max(100)
  bathrooms!: number;

  @Transform(safeNumber) @IsInt() @Min(1) @Max(100)
  accommodates!: number;
}

export class UpdatePropertyIdentityDto {
  @IsOptional() @IsString() @MaxLength(80)
  internalNickname?: string | null;

  @IsOptional() @IsString() @MaxLength(32)
  internalCode?: string | null;
}

export class UpdatePropertyPricingInputsDto {
  @IsOptional() @Transform(safeNumber) @IsNumber() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  manualDailyPrice?: number | null;

  @IsOptional() @Transform(safeNumber) @IsNumber() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  averageMonthlyRevenue?: number | null;
}

export class UpsertPropertyManualOccupancyDto {
  @IsString() @Matches(DATE_ONLY) @IsDateString({ strict: true })
  date!: string;

  @IsOptional() @IsIn(['booked', 'available', 'blocked', 'unknown'])
  status?: 'booked' | 'available' | 'blocked' | 'unknown';

  @IsOptional() @Transform(safeNumber) @IsNumber() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  revenue?: number | null;

  @IsOptional() @Transform(safeNumber) @IsNumber() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  listedPrice?: number | null;

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(0) @Max(3_650)
  nightsBooked?: number | null;
}
