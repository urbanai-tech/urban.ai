import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HostPanelsService } from './host-panels.service';

@ApiTags('ask-urban')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ask')
export class AskController {
  constructor(private readonly hostPanels: HostPanelsService) {}

  @ApiOperation({ summary: 'Uso diário do Ask Urban' })
  @Get('usage')
  async usage(@Req() req: any) {
    return this.hostPanels.askUsage(req.user.userId);
  }

  @ApiOperation({ summary: 'Responder pergunta do anfitrião usando dados reais da conta' })
  @Post('question')
  async question(
    @Req() req: any,
    @Body() body: { question?: string; conversationId?: string },
  ) {
    return this.hostPanels.askQuestion(req.user.userId, body);
  }

  @ApiOperation({ summary: 'Registrar feedback de uma resposta do AskUrban' })
  @Post('feedback')
  async feedback(
    @Req() req: any,
    @Body() body: { messageId?: string; vote?: 'up' | 'down' },
  ) {
    return this.hostPanels.askFeedback(req.user.userId, body);
  }
}
