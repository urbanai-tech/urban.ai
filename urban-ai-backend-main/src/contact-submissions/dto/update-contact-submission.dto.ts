import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ContactSubmissionCategory,
  ContactSubmissionSeverity,
  ContactSubmissionStatus,
} from '../../entities/contact-submission.entity';

export class UpdateContactSubmissionDto {
  @IsOptional()
  @IsIn(['new', 'in_progress', 'resolved', 'archived'])
  status?: ContactSubmissionStatus;

  @IsOptional()
  @IsIn(['sales', 'support', 'billing', 'privacy_lgpd', 'stays', 'incident', 'partnership'])
  category?: ContactSubmissionCategory;

  @IsOptional()
  @IsIn(['P0', 'P1', 'P2', 'P3'])
  severity?: ContactSubmissionSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  assignedOwner?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}
