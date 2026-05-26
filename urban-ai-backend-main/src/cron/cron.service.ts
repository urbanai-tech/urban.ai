import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AirbnbService } from 'src/airbnb/airbnb.service';
import { EmailService } from 'src/email/email.service';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { MailerService } from 'src/mailer/mailer.service';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';
import { PropriedadeService } from 'src/propriedades/propriedade.service';
import { getDiariaForCron } from 'src/util';
import { Raw, Repository } from 'typeorm';

type CronProcessingFailure = {
    analiseId: string;
    reason: string;
};

type CronProcessingResult = {
    iniciado: true;
    total: number;
    processed: number;
    skipped: number;
    failed: number;
    failures: CronProcessingFailure[];
};

@Injectable()
export class CronService {
    constructor(
        @InjectRepository(AnalisePreco)
        private readonly analisePrecoRepository: Repository<AnalisePreco>,
        private readonly airbnbService: AirbnbService,
        private readonly emailService: EmailService,
        private readonly mailerSender: MailerService,
        private readonly propriedadeService: PropriedadeService,
    ) { }

    private readonly logger = new Logger(CronService.name);

    private getAirbnbListingId(element: AnalisePreco): string | null {
        const listingId = element?.endereco?.list?.id_do_anuncio;
        return typeof listingId === 'string' && listingId.trim().length > 0
            ? listingId.trim()
            : null;
    }

    private getOwnerId(element: AnalisePreco): string | null {
        const ownerId = element?.usuarioProprietario?.id;
        return typeof ownerId === 'string' && ownerId.trim().length > 0
            ? ownerId.trim()
            : null;
    }

    private getAnalysisContext(element: AnalisePreco): string {
        return `analise=${element?.id ?? 'sem-id'} user=${element?.usuarioProprietario?.id ?? 'sem-user'} address=${element?.endereco?.id ?? 'sem-address'}`;
    }

    private formatAddressForNotification(element: AnalisePreco): string | undefined {
        const address = element?.endereco;
        if (!address) return undefined;
        const parts = [
            address.logradouro && address.numero ? `${address.logradouro}, ${address.numero}` : address.logradouro || address.numero,
            address.bairro,
            address.cidade && address.estado ? `${address.cidade} - ${address.estado}` : address.cidade || address.estado,
            address.cep ? `CEP ${address.cep}` : null,
        ].filter(Boolean);
        return parts.length ? parts.join(', ') : undefined;
    }

    private formatEventDate(value: Date | string | null | undefined): string | null {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: 'short',
        }).format(date);
    }

    private formatEventLocation(evento: AnalisePreco['evento']): string | null {
        const local = typeof evento?.local === 'string' && evento.local.trim()
            ? evento.local.trim()
            : null;
        const cityState = [
            evento?.cidade,
            evento?.estado,
        ].filter(Boolean).join(' - ');
        return local || evento?.enderecoCompleto || cityState || null;
    }

    private formatMoney(value: number): string {
        return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
    }

    private formatNumber(value: number): string {
        return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    }

    private buildPricingRecommendationNotification(
        element: AnalisePreco,
        currentPrice: number,
        suggestedPrice: number,
        liftPercent: number,
        direction: 'increase' | 'decrease',
    ): CreateNotificationDto {
        const list = element.endereco?.list;
        const propertyId = element.endereco?.id;
        const propertyTitle = list?.titulo || 'Imóvel';
        const eventName = element.evento?.nome || 'evento relevante';
        const eventDate = this.formatEventDate(element.evento?.dataInicio);
        const eventLocation = this.formatEventLocation(element.evento);
        const distanceKm = Number(element.distanciaSuaPropriedade);
        const relevance = Number(element.evento?.relevancia);
        const expectedAttendance = Number(element.evento?.expectedAttendance ?? element.evento?.capacidadeEstimada);
        const recommendation = String(element.recomendacao || '').trim();
        const action = direction === 'increase' ? 'aumentar' : 'diminuir';
        const title = direction === 'increase'
            ? 'Sugestão de preço para aumentar receita'
            : 'Sugestão de preço para ganhar competitividade';

        const reasons = [
            `Evento analisado: ${eventName}.`,
            `Data/local: ${[eventDate, eventLocation].filter(Boolean).join(' - ') || 'não informado'}.`,
            Number.isFinite(distanceKm)
                ? `Distância do imóvel: ${this.formatNumber(distanceKm)} km.`
                : 'Distância do imóvel: não informada.',
            [
                Number.isFinite(expectedAttendance)
                    ? `Público estimado de ${Math.round(expectedAttendance).toLocaleString('pt-BR')} pessoas`
                    : null,
                Number.isFinite(relevance)
                    ? `relevância ${Math.round(relevance)}/100`
                    : null,
                recommendation ? `recomendação: ${recommendation}` : null,
            ].filter(Boolean).join('; ') || 'Recomendação gerada pela análise de demanda local.',
        ];

        return {
            title,
            description: `A Urban AI recomenda ${action} o preço de ${propertyTitle} de ${this.formatMoney(currentPrice)} para ${this.formatMoney(suggestedPrice)} (${liftPercent > 0 ? '+' : ''}${this.formatNumber(liftPercent)}%).`,
            titleButton: 'Revisar recomendação',
            redirectTo: propertyId
                ? `/dashboard?propertyId=${encodeURIComponent(propertyId)}&source=cron_pricing_digest`
                : '/dashboard?source=cron_pricing_digest',
            sendEmail: true,
            sendPush: true,
            pushType: 'pricing_recommendation',
            pushTag: propertyId ? `pricing-recommendation-${propertyId}` : `pricing-recommendation-${element.id}`,
            metadata: {
                propertyTitle,
                propertyNickname: list?.internalNickname,
                propertyCode: list?.internalCode,
                propertyAddress: this.formatAddressForNotification(element),
                currentPrice,
                suggestedPrice,
                liftPercent,
                eventName,
                eventDate,
                eventLocation,
                distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
                expectedAttendance: Number.isFinite(expectedAttendance) ? expectedAttendance : null,
                relevance: Number.isFinite(relevance) ? relevance : null,
                recommendation: recommendation || null,
                reasons,
            },
        };
    }

    private async waitBetweenCronItems(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    async buscarAnalisesAceitas(): Promise<CronProcessingResult> {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataHoje = hoje.toISOString().split('T')[0];

        this.logger.log(`Buscando analises aceitas a partir de ${dataHoje}`);

        const aceites = await this.analisePrecoRepository.find({
            where: {
                aceito: true,
                evento: {
                    dataInicio: Raw(
                        (alias) => `DATE(${alias}) >= :dataHoje`,
                        { dataHoje },
                    ),
                },
            },
            relations: ['endereco', 'endereco.list', 'evento', 'usuarioProprietario'],
        });

        this.logger.log(`${aceites.length} analises aceitas encontradas`);

        const result: CronProcessingResult = {
            iniciado: true,
            total: aceites.length,
            processed: 0,
            skipped: 0,
            failed: 0,
            failures: [],
        };

        for (const element of aceites) {
            const context = this.getAnalysisContext(element);
            const listingId = this.getAirbnbListingId(element);
            const ownerId = this.getOwnerId(element);

            if (!listingId) {
                result.skipped += 1;
                this.logger.warn(`${context} ignorada no cron diario: endereco/listing Airbnb ausente.`);
                continue;
            }

            if (!ownerId) {
                result.skipped += 1;
                this.logger.warn(`${context} ignorada no cron diario: usuario proprietario ausente.`);
                continue;
            }

            try {
                this.logger.debug(
                    `Analise aceita ${context} listing=${listingId} diff=${element.diferencaPercentual}`,
                );

                console.log(`Buscando dados no Airbnb para o anuncio ${listingId}...`);
                const dadosProperty = await this.airbnbService.getFirstAvailablePrice(listingId);
                this.logger.debug(`Dados Airbnb recebidos para listing=${listingId}`);

                const diaria = getDiariaForCron(dadosProperty);
                const precoSugerido = Number(element.precoSugerido);
                const diferencaPercentual = Number(element.diferencaPercentual);

                if (!Number.isFinite(diaria) || !Number.isFinite(precoSugerido) || !Number.isFinite(diferencaPercentual)) {
                    throw new Error(`Valores invalidos no cron diario para ${context}`);
                }

                console.log(`Diaria atual no Airbnb: R$${diaria}`);
                console.log(`Preco sugerido: R$${precoSugerido}`);
                console.log(`Diferenca percentual: ${diferencaPercentual}%\n`);

                if (diferencaPercentual > 0) {
                    if (precoSugerido > diaria) {
                        console.log('Enfileirando digest -> Oportunidade de AUMENTAR o preco!');
                        const tdo = this.buildPricingRecommendationNotification(
                            element,
                            diaria,
                            precoSugerido,
                            diferencaPercentual,
                            'increase',
                        );
                        this.logger.log(`Enviando notificacao para user=${ownerId}`);
                        const { enviado } = await this.emailService.enviarNotification(ownerId, tdo);
                        console.log(enviado ? 'Notificacao de pricing enfileirada com sucesso!' : 'Falha ao enfileirar notificacao.');
                    }
                } else if (diferencaPercentual < 0) {
                    if (precoSugerido < diaria) {
                        console.log('Enfileirando digest -> Oportunidade de DIMINUIR o preco!');
                        const tdo = this.buildPricingRecommendationNotification(
                            element,
                            diaria,
                            precoSugerido,
                            diferencaPercentual,
                            'decrease',
                        );
                        this.logger.log(`Enviando notificacao para user=${ownerId}`);
                        const { enviado } = await this.emailService.enviarNotification(ownerId, tdo);
                        console.log(enviado ? 'Notificacao de pricing enfileirada com sucesso!' : 'Falha ao enfileirar notificacao.');
                    }
                } else {
                    console.log('Nenhuma notificacao necessaria para este imovel.');
                }

                result.processed += 1;
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                result.failed += 1;
                result.failures.push({
                    analiseId: element?.id ?? 'sem-id',
                    reason,
                });
                this.logger.error(
                    `Falha ao processar ${context} no cron diario: ${reason}`,
                    error instanceof Error ? error.stack : undefined,
                );
            }

            console.log('Aguardando 2 segundos antes do proximo...\n');
            await this.waitBetweenCronItems();
        }

        this.logger.log(
            `Cron diario finalizado: ${result.processed} processadas, ${result.skipped} ignoradas, ${result.failed} com erro`,
        );
        console.log('Processo finalizado com sucesso!\n');
        return result;
    }

    async enviarNotificacaoCron(subject: string, content: string) {
        const resultado = await this.mailerSender.sendTextEmailCron(
            { email: 'lucas@luminalab.ai', name: 'Dev feedback' },
            subject,
            content,
        );

        if (resultado.enviado) {
            console.log(`Email confirmado como enviado! (status ${resultado.status})`);
        } else {
            console.log(`Email NAO enviado (status ${resultado.status}): ${resultado.message}`);
        }
    }

    async buscarAnalisesAceitasTeste(): Promise<CronProcessingResult> {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataHoje = hoje.toISOString().split('T')[0];

        console.log(`Buscando analises aceitas a partir de ${dataHoje}...`);

        const aceites = await this.analisePrecoRepository.find({
            where: {
                aceito: true,
                evento: {
                    dataInicio: Raw(
                        (alias) => `DATE(${alias}) >= :dataHoje`,
                        { dataHoje },
                    ),
                },
            },
            relations: ['endereco', 'endereco.list', 'evento', 'usuarioProprietario'],
        });

        const result: CronProcessingResult = {
            iniciado: true,
            total: aceites.length,
            processed: 0,
            skipped: 0,
            failed: 0,
            failures: [],
        };

        console.log(`${aceites.length} analises aceitas encontradas.`);

        for (const element of aceites) {
            const context = this.getAnalysisContext(element);
            const listingId = this.getAirbnbListingId(element);

            if (!listingId) {
                result.skipped += 1;
                this.logger.warn(`${context} ignorada na simulacao: endereco/listing Airbnb ausente.`);
                continue;
            }

            try {
                this.logger.debug(`Simulando analise aceita user=${element.usuarioProprietario?.id ?? 'sem-user'}`);
                console.log(`- Diferenca percentual: ${element.diferencaPercentual}`);
                console.log(`- Recomendacao: ${element.recomendacao}`);
                console.log(`- Preco atual: ${element.seuPrecoAtual}`);
                console.log(`- Preco sugerido: ${element.precoSugerido}`);
                console.log(`- ID do anuncio Airbnb: ${listingId}`);

                const dadosProperty = await this.airbnbService.getFirstAvailablePrice(listingId);
                const diaria = getDiariaForCron(dadosProperty);
                const precoSugerido = Number(element.precoSugerido);
                const diferencaPercentual = Number(element.diferencaPercentual);

                console.log(`Diaria atual no Airbnb: ${diaria}`);

                if (diferencaPercentual > 0 && precoSugerido > diaria) {
                    console.log(`Simulacao: Enviar notificacao -> considere aumentar o preco para R$${precoSugerido}.`);
                } else if (diferencaPercentual < 0 && precoSugerido < diaria) {
                    console.log(`Simulacao: Enviar notificacao -> considere diminuir o preco para R$${precoSugerido}.`);
                } else {
                    console.log('Nenhuma notificacao necessaria.');
                }

                result.processed += 1;
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                result.failed += 1;
                result.failures.push({
                    analiseId: element?.id ?? 'sem-id',
                    reason,
                });
                this.logger.error(
                    `Falha ao simular ${context} no cron diario: ${reason}`,
                    error instanceof Error ? error.stack : undefined,
                );
            }

            await this.waitBetweenCronItems();
        }

        console.log('\nProcesso finalizado.');
        return result;
    }

    /**
     * Cron mensal noturno: re-scraping de todos os imoveis ativos.
     * Deve ser chamado via endpoint ou scheduler as 2h da manha, 1x/mes.
     * Espacado ao longo de 8h para evitar rate limiting.
     */
    async refreshPropertyMetadata(): Promise<any> {
        this.logger.log('[cron] Iniciando re-scraping mensal de metadados...');
        try {
            const result = await this.propriedadeService.refreshAllPropertyMetadata();
            this.logger.log(`[cron] Re-scraping concluido: ${result.updated}/${result.total} atualizados, ${result.errors} erros`);

            await this.enviarNotificacaoCron(
                'Re-scraping mensal concluido',
                `Total: ${result.total} | Atualizados: ${result.updated} | Erros: ${result.errors}`,
            );

            return result;
        } catch (error) {
            this.logger.error('[cron] Erro no re-scraping mensal:', error instanceof Error ? error.stack : String(error));
            throw error;
        }
    }
}
