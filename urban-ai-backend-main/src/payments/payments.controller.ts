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
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request, Response } from 'express'; // IMPORTA EXPRESS AQUI
import * as rawBody from 'raw-body';
import { ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
import Stripe from 'stripe';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

export class CreateCheckoutSessionDto {
  @ApiProperty({ example: "pro", description: 'Tag plano' })
  plan: string;

  @ApiProperty({ example: "monthly", description: 'Intervalo de cobrança (monthly/annual)', required: false })
  billingCycle?: 'monthly' | 'annual';
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) { }

  @UseGuards(JwtAuthGuard)
  @Post('create-checkout-session')
  async createCheckout(@Body() body: CreateCheckoutSessionDto, @Req() req: any) {
    console.log(body, req?.user?.userId)
    const session = await this.paymentsService.createCheckoutSession(body, req?.user?.userId);
    return { sessionId: session.id };
  }

  @UseGuards(JwtAuthGuard)
  @Get('getSubscription')
  async getSubscriptions(@Req() req: any) {
    const subscriptions = await this.paymentsService.getSubscription(req?.user?.userId);
    return subscriptions
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Lista os pagamentos do usuário autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pagamentos do usuário',
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
  @ApiResponse({ status: 401, description: 'Usuário não autenticado' })
  async getMyPayments(@Req() req: any) {
    const userId = req.user.userId;

    if (!userId) {
      throw new UnauthorizedException('🚫 Usuário não autenticado ou ID não fornecido');
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
        console.log('❌ Erro no webhook:', result.error);
        return res.status(400).send(`Webhook Error: ${result.error.message}`);
      }

      //console.log('✅ Evento recebido:', result.event.type);
      if (result.event.type == 'checkout.session.completed') {
        const session = result.event.data.object as Stripe.Checkout.Session;
        //console.log('🎯 Sessão completa:');
      }
      return res.send({ received: true });
    } catch (error) {
      console.log('❌ Erro inesperado:', error);
      return res.status(500).send('Internal Server Error');
    }
  }

}
