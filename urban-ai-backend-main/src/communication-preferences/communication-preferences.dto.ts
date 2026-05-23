import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCommunicationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailPricing?: boolean;

  @IsOptional()
  @IsBoolean()
  pushPricing?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyReport?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;

  @IsOptional()
  @IsBoolean()
  staysAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  billingAlerts?: boolean;
}
