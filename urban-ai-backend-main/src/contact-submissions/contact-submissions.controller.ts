import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { ContactSubmissionStatus } from '../entities/contact-submission.entity';
import { ContactSubmissionsService } from './contact-submissions.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { UpdateContactSubmissionDto } from './dto/update-contact-submission.dto';

@ApiTags('contact-submissions')
@Controller()
export class ContactSubmissionsController {
  constructor(
    private readonly contacts: ContactSubmissionsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  @ApiOperation({ summary: 'Receber mensagem do formulario publico de contato' })
  @Post('contact-submissions')
  create(@Body() body: CreateContactSubmissionDto, @Req() req: Request) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    return this.contacts.create(body, { ipAddress, userAgent });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'Listar mensagens de contato no admin' })
  @Get('admin/contact-submissions')
  list(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
    @Query('status') status?: ContactSubmissionStatus | 'all',
    @Query('search') search?: string,
  ) {
    return this.contacts.list({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      search,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'support')
  @ApiOperation({ summary: 'Atualizar status e notas de uma mensagem de contato' })
  @Patch('admin/contact-submissions/:id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateContactSubmissionDto,
    @Req() req: Request,
  ) {
    const result = await this.contacts.update(id, body);
    await this.audit.record({
      actorUserId: (req as any)?.user?.userId ?? null,
      action: 'contact_submission.update',
      entityType: 'contact_submission',
      entityId: id,
      after: {
        status: result.status,
        category: result.category,
        severity: result.severity,
        dueAt: result.dueAt,
        assignedOwner: result.assignedOwner,
        notes: result.notes,
      },
    });
    return result;
  }
}
