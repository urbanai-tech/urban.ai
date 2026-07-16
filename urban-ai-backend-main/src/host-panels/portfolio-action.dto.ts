import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

const PORTFOLIO_ACTIONS = [
  'set-base-price',
  'apply-strategy',
  'set-date-price',
  'accept-suggestions',
];
const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export class PortfolioActionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID('all', { each: true })
  propertyIds!: string[];

  @IsString() @IsIn(PORTFOLIO_ACTIONS)
  action!: string;

  @IsOptional() @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional() @IsArray() @ArrayMaxSize(360) @Matches(DATE_ONLY, { each: true })
  dates?: string[];

  @IsOptional() @Matches(DATE_ONLY)
  from?: string;

  @IsOptional() @Matches(DATE_ONLY)
  to?: string;
}
