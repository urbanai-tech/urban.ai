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
    // @UseGuards(JwtAuthGuard)
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
       // const userId = req.user.userId;
        //if (!userId) throw new UnauthorizedException('Usuário não autenticado');

        // Aqui chamamos o service que você já criou
        return this.sugestionService.alterarAceito(id, body.aceito);
    }

}
