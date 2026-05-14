import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    Req,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import { SugestionService } from './sugestion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

@ApiTags('Sugestões de Preço')
@ApiBearerAuth()
@Controller('sugestoes-preco')
export class SugestionController {
    constructor(private readonly sugestionService: SugestionService) { }
    @UseGuards(JwtAuthGuard)
    @Patch(':id/aceito')
    @ApiOperation({ summary: 'Altera o status de aceito de uma análise de preço' })
    @ApiBody({
        description: 'Parâmetro para definir se a análise está aceita ou não',
        schema: {
            example: {
                aceito: true,
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Status de aceito atualizado com sucesso',
        schema: {
            example: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                aceito: true,
                analise: { id: 'anal_abc123', evento: { id: 'evt_abc123', nome: 'Rock in Rio' } },
                usuarioProprietario: { id: 'usr_123456' },
                criadoEm: '2025-08-28T10:00:00.000Z',
            },
        },
    })
    async alterarAceito(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: { aceito: boolean },
    ) {
        return this.sugestionService.alterarAceito(id, req.user.userId, body.aceito);
    }

    /**
     * F6.1 Tier 3 — registrar o preço REAL aplicado após a sugestão.
     * Constrói o ground truth para medir MAPE.
     */
    @UseGuards(JwtAuthGuard)
    @Patch(':id/aplicado')
    @ApiOperation({
        summary: 'Registra o preço real aplicado pelo anfitrião (ground truth p/ MAPE)',
    })
    @ApiBody({
        description: 'Preço aplicado e origem da aplicação',
        schema: {
            example: {
                precoAplicado: 247.5,
                origem: 'manual_dashboard',
                reservaStatus: 'booked',
                receitaReal: 990,
                noitesReservadas: 4,
                feedbackObservacao: 'Reserva fechada no Airbnb',
            },
        },
    })
    async registrarPrecoAplicado(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
            precoAplicado: number;
            origem: 'manual_dashboard' | 'manual_off_platform' | 'stays_auto' | 'stays_user_accepted';
            reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
            receitaReal?: number | null;
            noitesReservadas?: number | null;
            feedbackObservacao?: string | null;
        },
    ) {
        return this.sugestionService.registrarPrecoAplicado(id, req.user.userId, {
            precoAplicado: body.precoAplicado,
            origem: body.origem,
            reservaStatus: body.reservaStatus,
            receitaReal: body.receitaReal,
            noitesReservadas: body.noitesReservadas,
            feedbackObservacao: body.feedbackObservacao,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/resultado')
    @ApiOperation({
        summary: 'Registra o resultado real da sugestÃ£o (reserva, receita, noites)',
    })
    @ApiBody({
        description: 'Resultado observado depois do evento',
        schema: {
            example: {
                reservaStatus: 'booked',
                receitaReal: 990,
                noitesReservadas: 4,
                precoAplicado: 247.5,
                feedbackObservacao: 'Reserva fechada no Airbnb',
            },
        },
    })
    async registrarResultado(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: {
            reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
            receitaReal?: number | null;
            noitesReservadas?: number | null;
            precoAplicado?: number | null;
            feedbackObservacao?: string | null;
        },
    ) {
        return this.sugestionService.registrarResultado(id, req.user.userId, body);
    }
}
