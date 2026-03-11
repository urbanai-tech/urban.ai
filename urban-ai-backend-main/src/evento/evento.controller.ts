import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { EventoService } from './evento.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Event } from 'src/entities/events.entity';

@Controller("event")
export class EventoController {
  constructor(private eventoService: EventoService) {}

  @Get()
  //  @UseGuards(JwtAuthGuard)
  async getEvents(
    @Req() req: any,
    @Query('propriedadeId') propriedadeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10
  ) {
    return await this.eventoService.findEventosPorEnderecoPaginado(
     propriedadeId,
      Number(page),
      Number(limit),
    );
  }



  @Get('all')
  @UseGuards(JwtAuthGuard)
  async getAll(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10
  ) {
    // Use paginated method instead of findAllEventos
    return this.eventoService.findAllEventosPaginado(
      Number(page),
      Number(limit),
    );
  }
}
