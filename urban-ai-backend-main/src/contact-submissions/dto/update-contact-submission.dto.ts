import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContactSubmissionStatus } from '../../entities/contact-submission.entity';

export class UpdateContactSubmissionDto {
  @IsOptional()
  @IsIn(['new', 'in_progress', 'resolved', 'archived'])
  status?: ContactSubmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}
