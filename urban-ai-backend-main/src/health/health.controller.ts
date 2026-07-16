import { Controller, Get, Headers, HttpCode, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller()
@ApiTags('Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Readiness detalhado da aplicação e dependências' })
  @ApiOkResponse({ description: 'Aplicação pronta para receber tráfego.' })
  @ApiUnauthorizedResponse({ description: 'Token de readiness ausente ou inválido.' })
  @ApiServiceUnavailableResponse({
    description: 'Readiness não configurado ou alguma dependência crítica não está pronta.',
  })
  async getHealth(
    @Headers('authorization') authorization?: string,
    @Res({ passthrough: true }) response?: Pick<Response, 'status'>,
  ) {
    this.healthService.assertReadinessAccess(authorization);
    const health = await this.healthService.getHealth();
    if (health.status !== 'ok') response?.status(503);
    return health;
  }

  @Get('health/live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness público do processo' })
  @ApiOkResponse({ description: 'Processo ativo.' })
  getLive() {
    return this.healthService.getLive();
  }
}
