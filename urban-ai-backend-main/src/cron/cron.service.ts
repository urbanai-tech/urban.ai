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
                        console.log('Enviando notificacao -> Oportunidade de AUMENTAR o preco!');
                        const tdo: CreateNotificationDto = {
                            title: 'Uma oportunidade para aumentar suas vendas!',
                            description: `Ola! Nossa analise indica que voce poderia aumentar o preco do seu imovel para R$${precoSugerido}, o que representa uma diferenca de ${diferencaPercentual}% em relacao ao seu preco atual de R$${diaria}. Aproveite essa oportunidade para maximizar seus ganhos!`,
                            redirectTo: '/painel',
                            sendEmail: true,
                        };
                        this.logger.log(`Enviando notificacao para user=${ownerId}`);
                        const { enviado } = await this.emailService.enviarNotification(ownerId, tdo);
                        console.log(enviado ? 'Email enviado com sucesso!' : 'Falha ao enviar email.');
                    }
                } else if (diferencaPercentual < 0) {
                    if (precoSugerido < diaria) {
                        console.log('Enviando notificacao -> Oportunidade de DIMINUIR o preco!');
                        const tdo: CreateNotificationDto = {
                            title: 'Uma oportunidade para aumentar suas vendas!',
                            description: `Ola! Nossa analise indica que voce poderia diminuir o preco do seu imovel para R$${precoSugerido}, o que representa uma diferenca de ${diferencaPercentual}% em relacao ao seu preco atual de R$${diaria}. Ajustar o preco pode aumentar suas chances de alugar mais rapidamente!`,
                            redirectTo: '/painel',
                            sendEmail: true,
                        };
                        this.logger.log(`Enviando notificacao para user=${ownerId}`);
                        const { enviado } = await this.emailService.enviarNotification(ownerId, tdo);
                        console.log(enviado ? 'Email enviado com sucesso!' : 'Falha ao enviar email.');
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
