import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateContactSubmissionDto {
  @IsString()
  @Length(2, 160)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(2, 220)
  subject: string;

  @IsString()
  @Length(10, 5000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
