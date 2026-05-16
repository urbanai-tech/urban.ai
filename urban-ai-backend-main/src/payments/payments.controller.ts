import {
  Controller,
  Post,
  Body,
  HttpCode,
  Header,
  Req,
  Res,
  Headers,
  UseGuards,
  Get,
  Delete,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request, Response } from 'express';
import { ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { BILLING_CYCLES } from './stripe-price-id.resolver';

export class CreateCheckoutSessionDto {
  @ApiProperty({ example: 'pro', description: 'Tag plano' })
  @IsString()
  @IsNotEmpty()
  plan: string;

  @ApiProperty({
    example: 'annual',
    description: 'Ciclo de cobranca (monthly | quarterly | semestral | annual)',
    required: false,
  })
  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: 'monthly' | 'quarterly' | 'semestral' | 'annual';

  @ApiProperty({
    example: 3,
    description: 'Quantidade de imoveis contratados',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  quantity?: number;
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-checkout-session')
  async createCheckout(@Body() body: CreateCheckoutSessionDto, @Req() req: any) {
    this.logger.log(
      `Creating checkout session for user=${req?.user?.userId} plan=${body.plan} cycle=${body.billingCycle || 'monthly'} quantity=${body.quantity ?? 1}`,
    );
    const session = await this.paymentsService.createCheckoutSession(body, req?.user?.userId);
    return { sessionId: session.id };
  }

  @UseGuards(JwtAuthGuard)
  @Get('listings-quota')
  @ApiOperation({ summary: 'F6.5 - quota de imoveis contratados vs ativos' })
  async getListingsQuota(@Req() req: any) {
    return this.paymentsService.getListingsQuota(req?.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('billing-portal-session')
  @ApiOperation({ summary: 'Cria sessao do Stripe Billing Portal para gerenciar plano/quantity' })
  async createBillingPortalSession(@Req() req: any) {
    return this.paymentsService.createBillingPortalSession(req?.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('getSubscription')
  async getSubscriptions(@Req() req: any) {
    return this.paymentsService.getSubscription(req?.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Lista os pagamentos do usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pagamentos do usuario',
    schema: {
      example: [
        {
          id: 'c1a2b3c4-d5e6-7890-1234-56789abcdef0',
          status: 'active',
          startDate: '2025-01-01T00:00:00.000Z',
          expireDate: '2025-02-01T00:00:00.000Z',
          subscriptionId: 'sub_1234567890',
          customerId: 'cus_1234567890',
          mode: 'subscription',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-10T00:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Usuario nao autenticado' })
  async getMyPayments(@Req() req: any) {
    const userId = req.user.userId;

    if (!userId) {
      throw new UnauthorizedException('Usuario nao autenticado ou ID nao fornecido');
    }

    return this.paymentsService.findByUserId(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('cancelSubscription')
  async cancelSubscription(@Req() req: any) {
    try {
      const canceledSubscription = await this.paymentsService.cancelSubscription(req?.user?.userId);
      return { message: 'Subscription cancelled successfully', canceledSubscription };
    } catch (error) {
      throw new HttpException(error.message || 'Erro ao cancelar subscription', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('webhook')
  @HttpCode(200)
  @Header('Content-Type', 'application/json')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      const buf = req.body as Buffer;
      const result = await this.paymentsService.handleStripeWebhook(buf, signature);

      if (result.error) {
        this.logger.warn(`Stripe webhook rejected: ${result.error.message}`);
        return res.status(400).send(`Webhook Error: ${result.error.message}`);
      }

      return res.send({ received: true });
    } catch (error) {
      this.logger.error(
        'Unexpected Stripe webhook error',
        error instanceof Error ? error.stack : String(error),
      );
      return res.status(500).send('Internal Server Error');
    }
  }
}
