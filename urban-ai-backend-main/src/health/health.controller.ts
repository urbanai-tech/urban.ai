import { Controller, Get, HttpCode } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('health/live')
  @HttpCode(200)
  getLive() {
    return this.healthService.getLive();
  }
}
