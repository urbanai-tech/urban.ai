import { Controller, Get, Headers, HttpCode } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth(@Headers('authorization') authorization?: string) {
    this.healthService.assertReadinessAccess(authorization);
    return this.healthService.getHealth();
  }

  @Get('health/live')
  @HttpCode(200)
  getLive() {
    return this.healthService.getLive();
  }
}
