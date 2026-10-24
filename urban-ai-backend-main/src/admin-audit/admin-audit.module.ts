import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminAuditService } from './admin-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLog])],
  providers: [AdminAuditService, { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor }],
  exports: [AdminAuditService],
})
export class AdminAuditModule {}
