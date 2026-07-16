import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUGGESTION_APPLICATION_SOURCES = [
  'manual_dashboard',
  'manual_off_platform',
  'stays_auto',
  'stays_user_accepted',
] as const;
export type SuggestionApplicationSource = (typeof SUGGESTION_APPLICATION_SOURCES)[number];

export const SUGGESTION_RESERVATION_STATUSES = [
  'unknown',
  'booked',
  'not_booked',
  'blocked',
] as const;
export type SuggestionReservationStatus = (typeof SUGGESTION_RESERVATION_STATUSES)[number];

export class VerifyPendingSuggestionsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SetSuggestionAcceptedDto {
  @ApiProperty()
  @IsBoolean()
  aceito!: boolean;
}

class SuggestionOutcomeDto {
  @ApiPropertyOptional({ enum: SUGGESTION_RESERVATION_STATUSES, nullable: true })
  @IsOptional()
  @IsIn(SUGGESTION_RESERVATION_STATUSES)
  reservaStatus?: SuggestionReservationStatus | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 99_999_999.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  receitaReal?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 36_500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(36_500)
  noitesReservadas?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedbackObservacao?: string | null;
}

export class RegisterAppliedPriceDto extends SuggestionOutcomeDto {
  @ApiProperty({ minimum: 0.01, maximum: 99_999_999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999.99)
  precoAplicado!: number;

  @ApiProperty({ enum: SUGGESTION_APPLICATION_SOURCES })
  @IsIn(SUGGESTION_APPLICATION_SOURCES)
  origem!: SuggestionApplicationSource;
}

export class RegisterSuggestionResultDto extends SuggestionOutcomeDto {
  @ApiPropertyOptional({ nullable: true, minimum: 0.01, maximum: 99_999_999.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999.99)
  precoAplicado?: number | null;
}
