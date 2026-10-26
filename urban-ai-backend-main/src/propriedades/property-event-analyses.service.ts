import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import dayjs from 'dayjs';
import { addDays, startOfDay, startOfMonth } from 'date-fns';

/**
 * PropertyEventAnalysesService — leitura das análises de preço por evento
 * (listas, mapa, acompanhamento e contagem) para o painel do anfitrião.
 */
@Injectable()
export class PropertyEventAnalysesService {
    constructor(
        @InjectRepository(AnalisePreco)
        private readonly analisePrecoRepository: Repository<AnalisePreco>,
    ) {}

    async getEventosByEnderecoForMap(
        enderecoId: string,
        userId: string,
        page: number = 1,
        limit: number = 10,
        raio: number,
        dataInicial?: string, // string ISO opcional
        dataFinal?: string    // string ISO opcional
    ) {
        console.log("raio:", raio);

        // Define datas padrão caso não sejam fornecidas
        const requestedStartDate = dataInicial
            ? dayjs(dataInicial).startOf('day').toDate()
            : dayjs().startOf('day').toDate(); // hoje 00:00:00
        const todayStart = dayjs().startOf('day').toDate();
        const startDate = requestedStartDate < todayStart ? todayStart : requestedStartDate;

        const endDate = dataFinal
            ? dayjs(dataFinal).endOf('day').toDate()
            : dayjs().add(7, 'day').endOf('day').toDate(); // daqui a 7 dias 23:59:59

        if (endDate < startDate) {
            return { data: [], total: 0, page, limit };
        }

        const [resultados, total] = await this.analisePrecoRepository.findAndCount({
            where: {
                endereco: { id: enderecoId },
                usuarioProprietario: { id: userId },
                distanciaSuaPropriedade: LessThanOrEqual(raio),
                evento: {
                    dataInicio: Between(startDate, endDate), // compara apenas dd/mm/yyyy
                },
            },
            relations: ['evento'],
            skip: (page - 1) * limit,
            take: limit,
            order: { criadoEm: 'DESC' },
        });

        return {
            data: resultados.map((analise) => ({
                ...analise.evento,
                distancia_metros: analise.distanciaSuaPropriedade,
                precoSugerido: analise.precoSugerido,
                seuPrecoAtual: analise.seuPrecoAtual,
                diferencaPercentual: analise.diferencaPercentual,
                recomendacao: analise.recomendacao,
                motivo_ia: analise.motivo_ia,
                criadoEm: analise.criadoEm,
                precoAplicado: analise.precoAplicado,
                aplicadoEm: analise.aplicadoEm,
                origemAplicacao: analise.origemAplicacao,
                status: analise.status,
                aceitoEm: analise.aceitoEm,
                rejeitadoEm: analise.rejeitadoEm,
                expiradoEm: analise.expiradoEm,
                reservaStatus: analise.reservaStatus,
                receitaReal: analise.receitaReal,
                noitesReservadas: analise.noitesReservadas,
                resultadoRegistradoEm: analise.resultadoRegistradoEm,
                feedbackObservacao: analise.feedbackObservacao,
                distanciaAteMinhaPropriedade: analise?.distanciaSuaPropriedade,
                idAnalise: analise.id,
                aceito: analise.aceito
            })),
            total,
            page,
            limit,
        };
    }

    async getEventosAcompanhando(
        enderecoId: string,
        page: number = 1,
        limit: number = 10,
        userId: string
    ) {

        const hoje = new Date();
        const inicioPeriodo = startOfDay(hoje);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

        if (enderecoId) {

            const [resultados, total] = await this.analisePrecoRepository.findAndCount({
                where: {
                    usuarioProprietario: { id: userId },
                    endereco: { id: enderecoId },
                    aceito: true, // ✅ filtra apenas aceitos
                    // 6a: overlap de intervalo (não só dataInicio) — pega evento
                    // multi-dia que cruza o período mesmo tendo começado antes.
                    evento: {
                        dataInicio: LessThanOrEqual(fimMes),
                        dataFim: MoreThanOrEqual(inicioPeriodo),
                    }
                },
                relations: ['evento'],
                skip: (page - 1) * limit,
                take: limit,
                order: { criadoEm: 'DESC' },

            });
            return {
                data: resultados.map((analise) => ({
                    ...analise.evento, // todos os campos do evento
                    distancia_metros: analise.distanciaSuaPropriedade,
                    precoSugerido: analise.precoSugerido,
                    seuPrecoAtual: analise.seuPrecoAtual,
                    diferencaPercentual: analise.diferencaPercentual,
                    recomendacao: analise.recomendacao,
                    motivo_ia: analise.motivo_ia,
                    criadoEm: analise.criadoEm,
                    precoAplicado: analise.precoAplicado,
                    aplicadoEm: analise.aplicadoEm,
                    origemAplicacao: analise.origemAplicacao,
                    status: analise.status,
                    aceitoEm: analise.aceitoEm,
                    rejeitadoEm: analise.rejeitadoEm,
                    expiradoEm: analise.expiradoEm,
                    reservaStatus: analise.reservaStatus,
                    receitaReal: analise.receitaReal,
                    noitesReservadas: analise.noitesReservadas,
                    resultadoRegistradoEm: analise.resultadoRegistradoEm,
                    feedbackObservacao: analise.feedbackObservacao,
                    idAnalise: analise.id,
                    aceito: analise.aceito,
                })),
                total,
                page,
                limit,
            };
        } else {
            const [resultados, total] = await this.analisePrecoRepository.findAndCount({
                where: {
                    aceito: true, // ✅ filtra apenas aceitos
                    // 6a: overlap de intervalo (ver branch acima).
                    evento: {
                        dataInicio: LessThanOrEqual(fimMes),
                        dataFim: MoreThanOrEqual(inicioPeriodo),
                    },
                    usuarioProprietario: { id: userId },
                },
                relations: ['evento'],
                skip: (page - 1) * limit,
                take: limit,
                order: { criadoEm: 'DESC' },
            });
            return {
                data: resultados.map((analise) => ({
                    ...analise.evento, // todos os campos do evento
                    distancia_metros: analise.distanciaSuaPropriedade,
                    precoSugerido: analise.precoSugerido,
                    seuPrecoAtual: analise.seuPrecoAtual,
                    diferencaPercentual: analise.diferencaPercentual,
                    recomendacao: analise.recomendacao,
                    motivo_ia: analise.motivo_ia,
                    criadoEm: analise.criadoEm,
                    precoAplicado: analise.precoAplicado,
                    aplicadoEm: analise.aplicadoEm,
                    origemAplicacao: analise.origemAplicacao,
                    status: analise.status,
                    aceitoEm: analise.aceitoEm,
                    rejeitadoEm: analise.rejeitadoEm,
                    expiradoEm: analise.expiradoEm,
                    reservaStatus: analise.reservaStatus,
                    receitaReal: analise.receitaReal,
                    noitesReservadas: analise.noitesReservadas,
                    resultadoRegistradoEm: analise.resultadoRegistradoEm,
                    feedbackObservacao: analise.feedbackObservacao,
                    idAnalise: analise.id,
                    aceito: analise.aceito,
                })),
                total,
                page,
                limit,
            };
        }


    }

    async getEventosByEndereco(
        enderecoId: string,
        userId: string,
        dataInicial: string,
        page: number = 1,
        limit: number = 10,
    ) {
        const inicioMes = startOfMonth(new Date(dataInicial));
        const hoje = startOfDay(new Date());
        const inicio = inicioMes < hoje ? hoje : inicioMes;
        const fim = addDays(inicioMes, 30);

        if (fim < inicio) {
            return { data: [], total: 0, page, limit };
        }
        const [resultados, total] = await this.analisePrecoRepository.findAndCount({
            where: {
                endereco: { id: enderecoId },
                usuarioProprietario: { id: userId },
                evento: {
                    dataInicio: Between(inicio, fim),
                },
            },
            relations: ['evento'],
            skip: (page - 1) * limit,
            take: limit,
            order: { criadoEm: 'DESC' },
        });

        return {
            data: resultados.map((analise) => ({
                ...analise.evento, // todos os campos do evento
                distancia_metros: analise.distanciaSuaPropriedade,
                precoSugerido: analise.precoSugerido,
                seuPrecoAtual: analise.seuPrecoAtual,
                diferencaPercentual: analise.diferencaPercentual,
                recomendacao: analise.recomendacao,
                motivo_ia: analise.motivo_ia,
                criadoEm: analise.criadoEm,
                precoAplicado: analise.precoAplicado,
                aplicadoEm: analise.aplicadoEm,
                origemAplicacao: analise.origemAplicacao,
                status: analise.status,
                aceitoEm: analise.aceitoEm,
                rejeitadoEm: analise.rejeitadoEm,
                expiradoEm: analise.expiradoEm,
                reservaStatus: analise.reservaStatus,
                receitaReal: analise.receitaReal,
                noitesReservadas: analise.noitesReservadas,
                resultadoRegistradoEm: analise.resultadoRegistradoEm,
                feedbackObservacao: analise.feedbackObservacao,
                idAnalise: analise.id,
                aceito: analise.aceito
            })),
            total,
            page,
            limit,
        };
    }

    async getQuantidadeEventosByUsuario(usuarioId: string, propertyId: string | null): Promise<number> {
        const hoje = new Date(); // data atual

        let total: number;

        if (propertyId) {
            total = await this.analisePrecoRepository.count({
                where: {
                    usuarioProprietario: { id: usuarioId },
                    endereco: { id: propertyId },
                    evento: {
                        dataInicio: MoreThanOrEqual(hoje), // apenas eventos a partir de hoje
                    },
                },
            });
        } else {
            total = await this.analisePrecoRepository.count({
                where: {
                    usuarioProprietario: { id: usuarioId },
                    evento: {
                        dataInicio: MoreThanOrEqual(hoje), // apenas eventos a partir de hoje
                    },
                },
            });
        }

        return total;
    }
}
