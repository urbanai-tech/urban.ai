import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller()
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {

    }
    @Get('receita-projetada/:usuarioId')
    @ApiOperation({ summary: 'Calcula a receita projetada do mês atual de um usuário' })
    @ApiParam({
        name: 'usuarioId',
        description: 'ID do usuário dono das propriedades',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Receita projetada calculada com sucesso',
        schema: {
            example: { receitaProjetada: 'R$ 15.2k' },
        },
    })
    async receitaProjetada(@Param('usuarioId') usuarioId: string) {
        const receita = await this.dashboardService.getReceitaProjetada(usuarioId, "");

        return {
            receitaProjetada: receita >= 1000
                ? `R$ ${(receita / 1000).toFixed(1)}k`
                : `R$ ${receita.toFixed(2)}`,
                receitaProjetadaSemFormatar: receita
        };
    }

    @Get('lucro-projetado/:usuarioId')
    @ApiOperation({ summary: 'Calcula o lucro projetado do mês atual para um usuário' })
    @ApiParam({
        name: 'usuarioId',
        description: 'ID do usuário dono das propriedades',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Lucro projetado calculado com sucesso',
        schema: {
            example: { lucroProjetado: 'R$ 4.5k' },
        },
    })
    async lucroProjetado(@Param('usuarioId') usuarioId: string) {
        const lucro = await this.dashboardService.getLucroProjetado(usuarioId, "");

        return {
            lucroProjetado: lucro >= 1000
                ? `R$ ${(lucro / 1000).toFixed(1)}k`
                : `R$ ${lucro.toFixed(2)}`,
                lucroProjetadoSemFormatar: lucro
        };
    }

    @Get('quantidade-enderecos/:usuarioId')
@ApiOperation({ summary: 'Quantidade de endereços únicos com sugestões aceitas no mês atual' })
@ApiParam({
  name: 'usuarioId',
  description: 'ID do usuário dono das propriedades',
  example: '123e4567-e89b-12d3-a456-426614174000',
})
@ApiResponse({
  status: 200,
  description: 'Quantidade de endereços retornada com sucesso',
  schema: {
    example: { quantidadeEnderecos: 3 },
  },
})
async quantidadeEnderecos(@Param('usuarioId') usuarioId: string) {
  const total = await this.dashboardService.getQuantidadeEnderecos(usuarioId, "");
  return { quantidadeEnderecos: total };
}


@UseGuards(JwtAuthGuard)
 @Get('/dados')
  @ApiOperation({ summary: 'Retorna informações consolidadas do dashboard de um usuário' })
  @ApiParam({
    name: 'propertyId',
    description: 'ID da propriedade',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard retornado com sucesso',
    schema: {
      example: {
        quantidadePropriedadesAtivas: 3,
        lucroProjetadoGeradoPeloUrban: 'R$ 4.5k',
        receitaProjetada: 'R$ 15.2k',
        quantidadeEventos: 7,
      },
    },
  })
  async getDashboard(@Req() req: any, @Query('propertyId') propertyId: string) {
    console.log("parametro:", propertyId)
    return this.dashboardService.getDashBoard(req.user.userId, propertyId);
  }

}
