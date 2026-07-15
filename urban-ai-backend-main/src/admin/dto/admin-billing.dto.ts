import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const COST_CATEGORIES = ['infra', 'apis', 'comms', 'payments', 'people', 'marketing', 'legal', 'data', 'other'];
const COST_RECURRENCES = ['monthly', 'usage_based', 'one_time', 'percentual'];

const nullableNumber = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : Number(value);

export class CreatePlatformCostDto {
  @IsString() @MinLength(2) @MaxLength(128)
  name!: string;

  @IsIn(COST_CATEGORIES)
  category!: string;

  @IsIn(COST_RECURRENCES)
  recurrence!: string;

  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000)
  monthlyCostCents!: number;

  @IsOptional() @Transform(nullableNumber) @IsNumber() @Min(0) @Max(100)
  percentOfRevenue?: number | null;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string | null;

  @IsOptional() @IsBoolean()
  scalesWithListings?: boolean;

  @IsOptional() @IsString() @MaxLength(5000)
  notes?: string | null;
}

export class UpdatePlatformCostDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(128)
  name?: string;

  @IsOptional() @IsIn(COST_CATEGORIES)
  category?: string;

  @IsOptional() @IsIn(COST_RECURRENCES)
  recurrence?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000)
  monthlyCostCents?: number;

  @IsOptional() @Transform(nullableNumber) @IsNumber() @Min(0) @Max(100)
  percentOfRevenue?: number | null;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string | null;

  @IsOptional() @IsBoolean()
  scalesWithListings?: boolean;

  @IsOptional() @IsString() @MaxLength(5000)
  notes?: string | null;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdatePlanPricingDto {
  @IsOptional() @IsString() @MaxLength(255) price?: string | null;
  @IsOptional() @IsString() @MaxLength(255) priceAnnual?: string | null;
  @IsOptional() @IsString() @MaxLength(255) priceMonthly?: string | null;
  @IsOptional() @IsString() @MaxLength(255) priceQuarterly?: string | null;
  @IsOptional() @IsString() @MaxLength(255) priceSemestral?: string | null;
  @IsOptional() @IsString() @MaxLength(255) priceAnnualNew?: string | null;
  @IsOptional() @IsString() @MaxLength(255) originalPriceMonthly?: string | null;
  @IsOptional() @IsString() @MaxLength(255) originalPriceQuarterly?: string | null;
  @IsOptional() @IsString() @MaxLength(255) originalPriceSemestral?: string | null;
  @IsOptional() @IsString() @MaxLength(255) originalPriceAnnualNew?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  discountQuarterlyPercent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  discountSemestralPercent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  discountAnnualPercent?: number;

  @IsOptional() @Transform(nullableNumber) @IsInt() @Min(0) @Max(100_000)
  propertyLimit?: number | null;
  @IsOptional() @Transform(nullableNumber) @IsInt() @Min(0) @Max(100_000)
  minProperties?: number | null;
  @IsOptional() @Transform(nullableNumber) @IsInt() @Min(0) @Max(100_000)
  maxProperties?: number | null;
  @IsOptional() @Transform(nullableNumber) @IsInt() @Min(0) @Max(100_000)
  maxCheckoutQuantity?: number | null;
  @IsOptional() @Transform(({ value }) => value === '' ? 0 : Number(value)) @IsInt() @Min(0) @Max(100_000)
  sortOrder?: number;

  @IsOptional() @IsBoolean() selfServiceEnabled?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(255) title?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(255, { each: true })
  features?: string[];
  @IsOptional() @IsString() @MaxLength(255) highlightBadge?: string | null;
  @IsOptional() @IsString() @MaxLength(255) discountBadge?: string | null;
}
