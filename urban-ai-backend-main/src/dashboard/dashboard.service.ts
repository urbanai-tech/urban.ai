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
        private readonly propriedadeService: PropriedadeService,
    ) {}

    async getReceitaProjetada(usuarioId: string, propertyId: string): Promise<any> {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

        const where: any = {
            usuarioProprietario: { id: usuarioId },
            aceito: true,
            evento: { dataInicio: Between(inicioMes, fimMes) },
        };
        if (propertyId) {
            where.endereco = { id: propertyId };
        }

        const analises = await this.analisePrecoRepositoru.find({ where });
        let diferencaPercentual = 0.0;

        analises.forEach((element) => {
            const precoSugerido = Number(element?.precoSugerido);
            const precoAtual = Number(element?.seuPrecoAtual);

            if (precoAtual && precoSugerido) {
                diferencaPercentual = ((precoSugerido - precoAtual) / precoAtual) * 100;
            }
        });

        const receitaProjetada = analises.reduce(
            (total, analise) => total + Number(analise.precoSugerido),
            0,
        );
        return { receitaProjetada, diferencaPercentual };
    }

    async getLucroProjetado(usuarioId: string, propertyId: string): Promise<number> {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

        const where: any = {
            usuarioProprietario: { id: usuarioId },
            aceito: true,
            evento: { dataInicio: Between(inicioMes, fimMes) },
        };
        if (propertyId) {
            where.endereco = { id: propertyId };
        }

        const analises = await this.analisePrecoRepositoru.find({ where });

        return analises.reduce((total, analise) => {
            return total + (Number(analise.precoSugerido) - Number(analise.seuPrecoAtual));
        }, 0);
    }

    async getDashBoard(usuarioId: string, propertyId: string) {
        const quantidadePropriedadesAtivas = await this.getQuantidadeEnderecos(usuarioId, propertyId);
        const lucroProjetadoGeradoPeloUrban = await this.getLucroProjetado(usuarioId, propertyId);
        const receitaProjetada = await this.getReceitaProjetada(usuarioId, propertyId);
        const quantidadeEventos = await this.propriedadeService.getQuantidadeEventosByUsuario(usuarioId, propertyId);

        return {
            quantidadePropriedadesAtivas,
            lucroProjetadoGeradoPeloUrban,
            receitaProjetada,
            quantidadeEventos,
        };
    }

    async getQuantidadeEnderecos(usuarioId: string, propertyId: string): Promise<number> {
        let query = null;
        if (propertyId) {
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
                .andWhere('analise.aceito = true');
        }

        const result = await query.getRawOne();
        return Number(result.total);
    }
}
