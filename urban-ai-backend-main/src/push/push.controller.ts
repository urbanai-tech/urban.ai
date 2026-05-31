import { Body, Controller, Delete, Get, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PushNotificationService } from './push-notification.service';
import { RemovePushSubscriptionDto, UpsertPushSubscriptionDto } from './push.dto';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushNotificationService) { }

  @Get('public-key')
  @ApiOperation({ summary: 'Retorna a chave pública VAPID para assinatura PWA' })
  getPublicKey() {
    return this.pushService.getPublicConfig();
  }

  @Post('subscriptions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cria ou atualiza assinatura Web Push do usuário autenticado' })
  async upsertSubscription(
    @Req() req: any,
    @Body() body: UpsertPushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.pushService.upsertSubscription(req.user.userId, body, userAgent);
  }

  @Delete('subscriptions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Desativa assinatura Web Push do usuário autenticado' })
  async removeSubscription(
    @Req() req: any,
    @Body() body: RemovePushSubscriptionDto,
  ) {
    return this.pushService.deactivateSubscription(req.user.userId, body);
  }

  @Post('test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Envia uma notificação PWA de teste para o usuário autenticado' })
  async sendTest(@Req() req: any) {
    return this.pushService.sendToUser(req.user.userId, {
      title: 'Urban AI',
      body: 'Push PWA ativo neste dispositivo.',
      url: '/notificacao',
      tag: 'urban-ai-pwa-test',
      data: { type: 'test' },
    });
  }

  @Get('deliveries/next')
  @ApiResponse({ status: 200, description: 'Payloads pendentes para o service worker' })
  async getPendingDeliveries(
    @Query('deviceId') deviceId: string,
    @Headers('x-urban-push-secret') secret?: string,
  ) {
    return this.pushService.getPendingDeliveries(deviceId, secret);
  }
}
