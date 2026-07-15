import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PricingRuleConfigItem, PricingRuleType } from '../entities/pricing-rule-config.entity';
import { SimulatePricingInput } from '../event-intelligence/event-intelligence.types';

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const DECIMAL = /^-?(?:\d+|\d*\.\d+)$/;
const PRICING_RULE_TYPES: PricingRuleType[] = [
  'weekend_uplift',
  'weekday_discount',
  'gap_night_filler',
  'last_minute',
  'length_of_stay',
  'min_stay_dynamic',
  'occupancy_floor',
  'event_uplift',
];

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const safePricingParams = ({ value }: { value: unknown }) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (typeof entry !== 'string') return [key, entry];
      const normalized = entry.trim();
      return [key, DECIMAL.test(normalized) ? Number(normalized) : entry];
    }),
  );
};

@ValidatorConstraint({ name: 'pricingRuleParams', async: false })
class PricingRuleParamsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entries = Object.entries(value);
    return (
      entries.length <= 32 &&
      entries.every(
        ([key, entry]) =>
          /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) &&
          typeof entry === 'number' &&
          Number.isFinite(entry) &&
          Math.abs(entry) <= 1_000_000,
      )
    );
  }

  defaultMessage() {
    return 'params deve conter no maximo 32 numeros finitos';
  }
}

export class AskQuestionDto {
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(4_000)
  question!: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(64)
  conversationId?: string;
}

export class AskFeedbackDto {
  @IsUUID()
  messageId!: string;

  @IsIn(['up', 'down'])
  vote!: 'up' | 'down';
}

export class SimulatePricingDto implements SimulatePricingInput {
  @IsOptional() @IsUUID()
  propertyId?: string;

  @IsOptional() @IsString() @Matches(DATE_ONLY) @IsDateString({ strict: true })
  targetDate?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(64)
  strategy?: string;
}

export class PricingRuleConfigItemDto implements PricingRuleConfigItem {
  @IsIn(PRICING_RULE_TYPES)
  type!: PricingRuleType;

  @IsBoolean()
  enabled!: boolean;

  @Transform(safePricingParams) @IsObject() @Validate(PricingRuleParamsConstraint)
  params!: Record<string, number>;

  @IsString() @MinLength(1) @MaxLength(128)
  label!: string;

  @IsString() @MaxLength(1_000)
  description!: string;
}

export class PricingRulesBodyDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => PricingRuleConfigItemDto)
  rules!: PricingRuleConfigItemDto[];
}
