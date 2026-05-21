import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionKeysDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class UpsertPushSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;
}

export class RemovePushSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}
