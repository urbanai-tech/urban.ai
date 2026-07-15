import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { ScheduledJobRunnerService } from './scheduled-job-runner.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminJobRun])],
  providers: [ScheduledJobRunnerService],
  exports: [ScheduledJobRunnerService],
})
export class AdminJobRunsModule {}
