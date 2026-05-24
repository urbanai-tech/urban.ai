import { Controller, Get, Query } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('quote')
  async quote(
    @Query('quantity') quantity: string = '1',
    @Query('billingCycle') billingCycle: string = 'annual',
  ) {
    return this.plansService.quoteSelfService(quantity, billingCycle);
  }

  @Get()
  async getPlans() {
    return this.plansService.getActivePlans();
  }
}
