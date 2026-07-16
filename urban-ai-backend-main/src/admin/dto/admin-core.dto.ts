import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmpty,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const DECIMAL = /^-?(?:\d+|\d*\.\d+)$/;

const safeNumber = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return DECIMAL.test(normalized) ? Number(normalized) : value;
};

const safeBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

@ValidatorConstraint({ name: 'hasListingIdentifier', async: false })
class HasListingIdentifierConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const input = args.object as AdminManualOccupancyDto;
    return Boolean(input.listId || input.airbnbListingId);
  }

  defaultMessage() {
    return 'listId ou airbnbListingId e obrigatorio';
  }
}

export class ScanEventDedupCandidatesDto {
  @IsOptional() @IsString() @IsDateString()
  from?: string;

  @IsOptional() @IsString() @IsDateString()
  to?: string;

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(50) @Max(5_000)
  limit?: number;

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(0) @Max(3_650)
  lookbackDays?: number;

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(1) @Max(3_650)
  lookaheadDays?: number;

  @IsOptional() @Transform(safeNumber) @IsNumber() @Min(0) @Max(1)
  minScore?: number;

  @IsOptional() @Transform(safeNumber) @IsNumber() @Min(0) @Max(1)
  highScore?: number;

  @IsOptional() @Transform(safeBoolean) @IsBoolean()
  includeInactive?: boolean;

  @IsOptional() @IsString() @MaxLength(128)
  source?: string;
}

export class RejectEventDedupCandidateDto {
  @IsOptional() @IsString() @MaxLength(1_000)
  reason?: string;
}

export class BackfillEventIntelligenceDto {
  @IsOptional() @IsString() @Matches(DATE_ONLY) @IsDateString({ strict: true })
  from?: string;

  @IsOptional() @IsString() @Matches(DATE_ONLY) @IsDateString({ strict: true })
  to?: string;

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(1) @Max(365)
  lookaheadDays?: number;

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString() @MaxLength(128)
  source?: string;

  @IsOptional() @IsString() @MaxLength(128)
  category?: string;

  @IsOptional() @IsString() @MaxLength(128)
  city?: string;

  @IsOptional() @IsString() @MaxLength(255)
  search?: string;

  @IsOptional() @IsIn(['in', 'out', 'all'])
  scope?: 'in' | 'out' | 'all';

  @IsOptional() @Transform(safeBoolean) @IsBoolean()
  force?: boolean;
}

export class AdminManualOccupancyDto {
  @IsOptional() @IsUUID()
  listId?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(64)
  airbnbListingId?: string;

  @IsString() @Matches(DATE_ONLY) @IsDateString({ strict: true })
  date!: string;

  @IsIn(['booked', 'available', 'blocked', 'unknown'])
  status!: 'booked' | 'available' | 'blocked' | 'unknown';

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(0) @Max(2_147_483_647)
  revenueCents?: number | null;

  @IsOptional() @Transform(safeNumber) @IsInt() @Min(0) @Max(2_147_483_647)
  listedPriceCents?: number | null;

  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsEmpty() @Validate(HasListingIdentifierConstraint)
  private readonly listingIdentifierGuard?: never;
}

export class SetUserRoleDto {
  @IsIn(['host', 'admin', 'support'])
  role!: 'host' | 'admin' | 'support';
}

export class SetUserActiveDto {
  @IsBoolean()
  ativo!: boolean;
}
