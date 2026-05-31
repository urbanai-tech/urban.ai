import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateCommunicationPreferencesDto } from './communication-preferences.dto';
import { CommunicationPreferencesService } from './communication-preferences.service';

@ApiTags('communication-preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('communication-preferences')
export class CommunicationPreferencesController {
  constructor(private readonly preferencesService: CommunicationPreferencesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna preferências de comunicação do usuário autenticado' })
  getMine(@Req() req: any) {
    return this.preferencesService.getForUser(req.user.userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Atualiza preferências de comunicação do usuário autenticado' })
  updateMine(@Req() req: any, @Body() body: UpdateCommunicationPreferencesDto) {
    return this.preferencesService.updateForUser(req.user.userId, body);
  }
}
