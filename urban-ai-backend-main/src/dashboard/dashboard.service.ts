import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { PropriedadeService } from 'src/propriedades/propriedade.service';
import { Between, Repository } from 'typeorm';

@Injectable()
export class DashboardService {

    constructor(
        @InjectRepository(AnalisePreco)
        private readonly analisePrecoRepositoru: Repository<AnalisePreco>,
        private readonly propriedadeService: PropriedadeService) {
    }

    async getReceitaProjetada(usuarioId: string, propertyId: string): Promise<any> {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1); // dia 01 do mês atual
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999); // último dia do mês atual

        let analises: AnalisePreco[] = [];
        if (propertyId) {
            analises = await this.analisePrecoRepositoru.find({
                where: {
                    usuarioProprietario: { id: usuarioId },
                    endereco: { id: propertyId },
                    aceito: true,
                    evento: { dataInicio: Between(inicioMes, fimMes) }

                },
            });
        } else {
            analises = await this.analisePrecoRepositoru.find({
                where: {
                    usuarioProprietario: { id: usuarioId },
                    aceito: true,
                    evento: { dataInicio: Between(inicioMes, fimMes) }

                },
            });
        }
        let diferencaPercentual = 0.0;
        analises.forEach(element => {
            const precoSugerido = Number(element?.precoSugerido);
            const precoAtual = Number(element?.seuPrecoAtual);

            if (precoAtual && precoSugerido) {
                diferencaPercentual = ((precoSugerido - precoAtual) / precoAtual) * 100;
                console.log(
                    "sugerido:", precoSugerido,
                    "atual:", precoAtual,
                    "diferença %:", diferencaPercentual.toFixed(2) + "%"
                );
            } else {
                console.log("Valores inválidos para cálculo", element);
            }
        });
    
        const receitaProjetada = analises.reduce((total, analise) => total + Number(analise.precoSugerido), 0);
    console.log("Analises->", analises.length)
        analises.forEach(element => {
            console.log(element.precoSugerido)
        });
        return {receitaProjetada, diferencaPercentual};
    }

    async getLucroProjetado(usuarioId: string, propertyId: string): Promise<number> {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1); // 1º dia do mês
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999); // último dia do mês

        let analises = null;
        if (propertyId) {
            analises = await this.analisePrecoRepositoru.find({
                where: {
                    usuarioProprietario: { id: usuarioId },
                    endereco: { id: propertyId },
                    aceito: true,
                    evento: { dataInicio: Between(inicioMes, fimMes) }
                },
            });
        } else {
            analises = await this.analisePrecoRepositoru.find({
                where: {
                    usuarioProprietario: { id: usuarioId },
                    aceito: true,
                    evento: { dataInicio: Between(inicioMes, fimMes) }
                },
            });
        }
   

        const lucroProjetadoComSugestaoUrban = analises.reduce((total, analise) => {
            return total + (Number(analise.precoSugerido) - Number(analise.seuPrecoAtual));
        }, 0);

        return lucroProjetadoComSugestaoUrban;
    }

    async getDashBoard(usuarioId: string, propertyId: string) {

        const quantidadePropriedadesAtivas = await this.getQuantidadeEnderecos(usuarioId, propertyId)
        const lucroProjetadoGeradoPeloUrban = await this.getLucroProjetado(usuarioId, propertyId)
        const receitaProjetada = await this.getReceitaProjetada(usuarioId, propertyId)
        const quantidadeEventos = await this.propriedadeService.getQuantidadeEventosByUsuario(usuarioId, propertyId)
        return {
            quantidadePropriedadesAtivas,
            lucroProjetadoGeradoPeloUrban,
            receitaProjetada,
            quantidadeEventos
        }
    }

    async getQuantidadeEnderecos(usuarioId: string, propertyId: string): Promise<number> {
        console.log("propriedade", propertyId)
        let query = null;
        if (propertyId) {
            console.log("caindo aqui")
            query = this.analisePrecoRepositoru
                .createQueryBuilder('analise')
                .select('COUNT(DISTINCT analise.endereco_id)', 'total')
                .where('analise.usuario_proprietario_id = :usuarioId', { usuarioId })
                .andWhere('analise.aceito = true')
                .andWhere('analise.endereco_id = :propertyId', { propertyId });
        } else {
            query = this.analisePrecoRepositoru
                .createQueryBuilder('analise')
                .select('COUNT(DISTINCT analise.endereco_id)', 'total')
                .where('analise.usuario_proprietario_id = :usuarioId', { usuarioId })
                .andWhere('analise.aceito = true')
        }


        const result = await query.getRawOne();
        return Number(result.total);
    }



}
