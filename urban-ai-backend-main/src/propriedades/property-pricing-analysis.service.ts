import { forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { HTTP_TIMEOUT_MS } from '../common/http-timeouts';
import { Address } from 'src/entities/addresses.entity';
import { Between, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { List } from 'src/entities/list.entity';
import { APITypes } from './types/nearProperties';
import { PricingCalculateService } from './pricing-calculate.service';
import { calculateDistance, getDiaria } from 'src/util';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { Event as EventEntity } from 'src/entities/events.entity';
import { AirbnbService } from 'src/airbnb/airbnb.service';
import pLimit from 'p-limit';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { User } from 'src/entities/user.entity';
import { EmailService } from 'src/email/email.service';
import { FirstAvailablePriceResult } from 'src/airbnb/types';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';
import { UrbanAIPricingEngine } from '../knn-engine/pricing-engine';
import { PropertyClassifier } from '../knn-engine/knn-classifier';
import { deriveKnnLabels } from '../knn-engine/knn-labels';
import { resolvePricingEngineMode } from '../knn-engine/pricing-engine-v2';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { PricingGuardrailService } from './pricing-guardrail.service';
import { OccupancyHistory } from 'src/entities/occupancy-history.entity';
import { PricingRuleConfig } from 'src/entities/pricing-rule-config.entity';
import { addDaysToDateKey, toDayKey } from '../common/sp-date';
import type { PricingContextV2 } from '../knn-engine/pricing-engine-v2';
import {
    PricingNotificationHighlight,
    nullableNumber,
    isSameNumber,
    compactText,
    formatMoney,
    formatEventDateForEmail,
    formatSuggestionCount,
    normalizeRole,
    formatAddressForEmail,
    getUniqueAnalysesByEvent,
    getPricingEventQualityFlags,
    isSamePricingAnalysis,
    buildPricingNotificationDescription,
    selectPrimaryPricingHighlight,
    buildPricingDigestReasons,
    resolveStoredDailyPrice,
    buildManualPriceQuote,
    toDirectComp,
} from './propriedade.helpers';

/**
 * PropertyPricingAnalysisService — pipeline de análise de preço por imóvel:
 * comps (RapidAPI/scraping direto), cotação base, cálculo por evento (math +
 * motor IA + guardrails), persistência deduplicada e notificação/digest ao
 * anfitrião.
 */
@Injectable()
export class PropertyPricingAnalysisService {
    // Mantém o contexto de log original para não quebrar buscas/alertas existentes.
    private readonly logger = new Logger('PropriedadeService');

    constructor(
        @InjectRepository(Address)
        private readonly addressRepository: Repository<Address>,
        @InjectRepository(List)
        private readonly propriedades: Repository<List>,
        private readonly pricingCalculateService: PricingCalculateService,
        @InjectRepository(AnaliseEnderecoEvento)
        private readonly analiseEnderecoEventoRepository: Repository<AnaliseEnderecoEvento>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(EventEntity)
        private readonly eventoRepository: Repository<EventEntity>,
        @InjectRepository(AnalisePreco)
        private readonly analisePrecoRepository: Repository<AnalisePreco>,
        @InjectRepository(OccupancyHistory)
        private readonly occupancyHistoryRepository: Repository<OccupancyHistory>,
        @Inject(forwardRef(() => AirbnbService))
        private readonly airbnbService: AirbnbService,
        private readonly emailService: EmailService,
        private readonly aiEngine: UrbanAIPricingEngine,
        private readonly datasetCollector: DatasetCollectorService,
        private readonly pricingGuardrailService: PricingGuardrailService,
        @Optional()
        @InjectRepository(PricingRuleConfig)
        private readonly pricingRuleConfigRepository?: Repository<PricingRuleConfig>,
    ) {}

    async criarAlertaAirbnb(data: {
        latitude: number;
        longitude: number;
        bedrooms: number;
        bathrooms: number;
        accommodates: number;
    }) {

        const BASE_URL = 'https://airbnb-income-prediction.p.rapidapi.com/';
        const RAPIDAPI_HOST = 'airbnb-income-prediction.p.rapidapi.com';
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY as string;

        try {
            const response = await axios.post(BASE_URL, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-rapidapi-host': RAPIDAPI_HOST,
                    'x-rapidapi-key': RAPIDAPI_KEY,
                },
                timeout: HTTP_TIMEOUT_MS.default,
            });

            return response.data;
        } catch (error: any) {
            console.error('Erro ao buscar listagens do usuário:', error.response?.data || error.message);
            throw new HttpException(
                error.response?.data || 'Erro ao buscar listagens do usuário',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async buscarAlertPorId(id: string): Promise<APITypes> {
        const BASE_URL = `https://airbnb-income-prediction.p.rapidapi.com/?id=${id}`;
        const RAPIDAPI_HOST = 'airbnb-income-prediction.p.rapidapi.com';
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY as string;

        try {
            const response = await axios.get<APITypes>(BASE_URL, {
                headers: {
                    'x-rapidapi-host': RAPIDAPI_HOST,
                    'x-rapidapi-key': RAPIDAPI_KEY,
                },
                timeout: HTTP_TIMEOUT_MS.default,
            });

            return response.data;
        } catch (error: any) {
            console.error('Erro ao buscar dados da propriedade:', error.response?.data || error.message);
            throw new HttpException(
                error.response?.data || 'Erro ao buscar dados da propriedade',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async compilarEventosFuturosPorUsuario(userId: string) {
        try {
            const hoje = new Date();
            console.log(`📅 Buscando eventos futuros para usuário ${userId} a partir de: ${hoje.toISOString()}`);

            const user = await this.userRepository.findOne({
                where: { id: userId }
            });

            if (!user) {
                console.log(`❌ Usuário não encontrado: ${userId}`);
                return null;
            }

            // pega análises só de eventos futuros para esse usuário
            const analises = await this.analisePrecoRepository.find({
                where: {
                    usuarioProprietario: { id: user.id },
                    criadoEm: MoreThanOrEqual(hoje), // aqui filtra pelo campo criadoEm
                },
                relations: ['evento'],
            });


            const eventosUnicos = new Set(
                analises.map(a => a.evento?.id)
            );

            const relatorioUsuario = {
                usuarioId: user.id,
                username: user.username || '',
                email: user.email || '',
                eventosUnicosFuturos: eventosUnicos.size,
                emailDisparado: false,
            };

            if (eventosUnicos.size > 0) {
                this.logger.debug(
                    `Usuário ${user.id} possui ${eventosUnicos.size} eventos futuros únicos analisados; e-mail legado suprimido.`,
                );
            } else {
                this.logger.debug(`Nenhum evento futuro disponível para user=${user.id}`);
            }

            return relatorioUsuario;
        } catch (error) {
            console.error(`❌ Erro ao compilar eventos futuros para usuário ${userId}:`, error);
            return null;
        }
    }

    private getUniqueAnalysesByEvent(analyses: AnaliseEnderecoEvento[]) {
        return getUniqueAnalysesByEvent(analyses);
    }

    private buildPricingNotificationDescription(listTitle: string | undefined, created: number, updated: number) {
        return buildPricingNotificationDescription(listTitle, created, updated);
    }

    private formatSuggestionCount(count: number, qualifier?: string) {
        return formatSuggestionCount(count, qualifier);
    }

    private formatAddressForEmail(address: Address | null | undefined): string | undefined {
        return formatAddressForEmail(address);
    }

    private selectPrimaryPricingHighlight(highlights: PricingNotificationHighlight[]) {
        return selectPrimaryPricingHighlight(highlights);
    }

    private buildPricingDigestReasons(
        highlights: PricingNotificationHighlight[],
        created: number,
        updated: number,
    ): string[] {
        return buildPricingDigestReasons(highlights, created, updated);
    }

    private compactText(value?: string | null): string | null {
        return compactText(value);
    }

    private formatMoney(value: number): string {
        return formatMoney(value);
    }

    private formatEventDateForEmail(value: Date | string | null | undefined): string | null {
        return formatEventDateForEmail(value);
    }

    async buscarAddress(listId: string) {

        try {
            const startedAt = new Date();
            const pricingFailureReasons: Record<string, number> = {};
            this.logger.log(`Buscando endereço com idAlertAirb válido para list=${listId}`);
            console.log("🔍 Buscando endereço com idAlertAirb válido...");
            const address = await this.addressRepository.findOne({
                where: {
                    list: { id: listId },
                    idAlertAirb: Not("no_id")
                },
            });

            if (!address) {
                this.logger.warn(`Nenhum endereço com idAlertAirb válido para list=${listId}; pricing não será gerado.`);
                return { ok: false, reason: 'missing_alert_airb', pricingGenerated: 0 };
            }
            if (!address.user?.id) {
                this.logger.warn(`Endereço ${address.id} sem usuário associado; pricing não será gerado.`);
                return { ok: false, reason: 'address_without_user', pricingGenerated: 0 };
            }
            if (address.user.ativo === false) {
                this.logger.warn(`Usuário ${address.user.id} inativo; pricing não será gerado para list=${listId}.`);
                return { ok: false, reason: 'inactive_user', pricingGenerated: 0 };
            }
            if (!address.list?.id) {
                this.logger.warn(`Endereço ${address.id} sem imóvel associado; pricing não será gerado.`);
                return { ok: false, reason: 'address_without_listing', pricingGenerated: 0 };
            }

            const list = await this.propriedades.findOne({
                where: {
                    id: address.list.id
                },
            });
            const dadosAirbnb = await this.getPricingBaseQuote(list);

            if (!dadosAirbnb?.price?.status || !dadosAirbnb?.propertyDetails) {
                this.logger.warn(`Não foi possível obter preço Airbnb para list=${listId}`);
                return { ok: false, reason: 'missing_airbnb_price', pricingGenerated: 0 };
            }

            let alerts: APITypes | null = null;
            if (address?.idAlertAirb && address.idAlertAirb !== 'scraping_direct') {
                try {
                    alerts = await this.buscarAlertPorId(address.idAlertAirb);
                } catch (error) {
                    this.logger.warn(
                        `Falha ao buscar comps externos para list=${listId}; tentando fallback direto: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    );
                }
            }

            if (!alerts?.comps?.length) {
                alerts = await this.buildDirectScrapingComps(address, list, dadosAirbnb);
            }

            this.logger.debug(`Dados Airbnb carregados para list=${list?.id}`);
            if (!alerts?.comps?.length) {
                this.logger.warn(`Nenhum comparável encontrado para list=${listId}; pricing não será gerado.`);
                return { ok: false, reason: 'missing_comps', pricingGenerated: 0 };
            }
            const maxObj = alerts.comps.reduce((prev, curr) =>
                curr.similarity_score > prev.similarity_score ? curr : prev
            );
            let propriedadeReferencia: FirstAvailablePriceResult;
            try {
                propriedadeReferencia = await this.airbnbService.getFirstAvailablePrice(maxObj?.listingID);
            } catch (error) {
                const referencePrice = Number(maxObj?.avg_booked_daily_rate_ltm);
                if (!Number.isFinite(referencePrice) || referencePrice <= 0) throw error;
                propriedadeReferencia = this.buildManualPriceQuote(referencePrice, {
                    bedrooms: Number(maxObj?.bedrooms ?? list?.quartos ?? 1),
                    beds: Number((maxObj as any)?.beds ?? list?.camas ?? 1),
                    guestMaximum: Number(maxObj?.accommodates ?? list?.hospedes ?? 1),
                });
            }
            //console.log(maxObj)
            // console.log(propriedadeReferencia)
            // console.log("Valores:")
            // console.log(getDiaria(dadosAirbnb))


            if (!address) {
                console.log("❌ Não existe um address com airbnb id");
                return;
            }
            console.log("✅ Endereço encontrado:", address?.idAlertAirb);

            console.log("📋 Buscando análises de endereço de evento...");
            const enderecoAnalises = await this.analiseEnderecoEventoRepository.find({
                where: { endereco: { id: address?.id } }, // filtra pelo endereço específico
                relations: ['evento', 'endereco', 'usuarioProprietario'], // traz as relações
            });

            console.log(`🔹 ${enderecoAnalises.length} análises encontradas para o endereço`);

            // Limite de threads para processamento pesado
            const limit = pLimit(2); // no máximo 3 eventos ao mesmo tempo

            const pricingAnalyses = this.getUniqueAnalysesByEvent(enderecoAnalises);
            const pricingDuplicateTransportRows = enderecoAnalises.length - pricingAnalyses.length;
            if (pricingDuplicateTransportRows > 0) {
                this.logger.debug(
                    `Ignorando ${pricingDuplicateTransportRows} analises duplicadas por modo de transporte para list=${listId}`,
                );
            }

            let pricingGenerated = 0;
            let pricingCreated = 0;
            let pricingUpdated = 0;
            let pricingUnchanged = 0;
            let pricingFailed = 0;
            let pricingSkippedPastEvent = 0;
            let pricingSkippedNoCoordinates = 0;
            const pricingSkippedEventQuality: Record<string, number> = {};
            const pricingHighlights: PricingNotificationHighlight[] = [];
            const promises = pricingAnalyses.map((element, index) =>
                limit(async () => {
                    try {
                        const evento = element?.evento;
                        const thereIsLatLong = evento?.latitude && evento?.longitude;
                        if (!evento?.dataInicio || new Date(evento.dataInicio) < startedAt) {
                            pricingSkippedPastEvent++;
                            return;
                        }
                        const eventQualityFlags = this.getPricingEventQualityFlags(evento, startedAt);
                        if (eventQualityFlags.length > 0) {
                            for (const flag of eventQualityFlags) {
                                pricingSkippedEventQuality[flag] = (pricingSkippedEventQuality[flag] ?? 0) + 1;
                            }
                            this.logger.warn(
                                `Evento ${evento?.id} ignorado para pricing por qualidade: ${eventQualityFlags.join(', ')}`,
                            );
                            return;
                        }

                        console.log(`🔍 [${index + 1}/${pricingAnalyses.length}] Analisando evento: ${evento?.id} (${evento?.nome ?? 'sem nome'})`);

                        if (thereIsLatLong) {
                            console.log("📍 Evento possui latitude e longitude. Executando cálculo de preço...");
                            const pricingResult = await this.getPricingPropriedadeByEventAndByProperty(
                                address?.idAlertAirb,
                                address?.list?.id,
                                element?.evento?.id,
                                dadosAirbnb,
                                propriedadeReferencia,
                                alerts
                            );
                            if (pricingResult?.ok) {
                                if (pricingResult.unchanged) {
                                    pricingUnchanged++;
                                } else {
                                    pricingGenerated++;
                                    if (pricingResult.updated) {
                                        pricingUpdated++;
                                    } else {
                                        pricingCreated++;
                                    }
                                    pricingHighlights.push({
                                        eventName: pricingResult.eventName,
                                        eventDate: pricingResult.eventDate,
                                        eventLocation: pricingResult.eventLocation,
                                        distanceKm: pricingResult.distanceKm,
                                        relevance: pricingResult.relevance,
                                        expectedAttendance: pricingResult.expectedAttendance,
                                        currentPrice: pricingResult.currentPrice,
                                        suggestedPrice: pricingResult.suggestedPrice,
                                        liftPercent: pricingResult.liftPercent,
                                        recommendation: pricingResult.recommendation,
                                        reason: pricingResult.reason,
                                    });
                                }
                            } else {
                                pricingFailed++;
                                const reason = pricingResult?.reason || 'unknown_pricing_failure';
                                pricingFailureReasons[reason] = (pricingFailureReasons[reason] ?? 0) + 1;
                            }
                            console.log(`✅ [${index + 1}/${pricingAnalyses.length}] Cálculo finalizado para o evento: ${evento?.id}`);
                        } else {
                            pricingSkippedNoCoordinates++;
                            console.log(`⚠️ [${index + 1}/${pricingAnalyses.length}] Evento não possui latitude e longitude. Pulando cálculo.`);
                        }
                    } catch (eventError) {
                        pricingFailed++;
                        const reason = eventError instanceof Error ? eventError.message : 'unknown_error';
                        pricingFailureReasons[reason] = (pricingFailureReasons[reason] ?? 0) + 1;
                        console.log(`❌ [${index + 1}/${pricingAnalyses.length}] Erro ao processar análise do evento:`, eventError);
                    }
                })
            );

            await Promise.all(promises); // aguarda todos os eventos processarem
            console.log("🏁 Finalizado o processamento de todas as análises do endereço");

            //await this.emailService.enviarEmailAvisandoQueOsDadosForamProcessados(address?.user?.email)

            const notificationContent: CreateNotificationDto = {
                title: "Análise concluída",
                description: `A Urban AI analisou os eventos para a propriedade ${list?.titulo || 'sem título'}.`,
                redirectTo: "/dashboard",
                sendEmail: false,
                sendPush: true,
                pushType: 'property_analysis_finished',
                pushTag: `property-analysis-${listId}`,
            };
            if (pricingGenerated > 0) {
                const primaryHighlight = this.selectPrimaryPricingHighlight(pricingHighlights);
                notificationContent.title = "Sugestões de preço disponíveis";
                notificationContent.description = this.buildPricingNotificationDescription(
                    list?.titulo,
                    pricingCreated,
                    pricingUpdated,
                );
                notificationContent.redirectTo = `/dashboard?propertyId=${encodeURIComponent(address.id)}&source=pwa_push_pricing`;
                notificationContent.sendEmail = true;
                notificationContent.pushType = 'pricing_recommendation';
                notificationContent.pushTag = `pricing-recommendation-${listId}`;
                notificationContent.metadata = {
                    propertyTitle: list?.titulo,
                    propertyNickname: list?.internalNickname,
                    propertyCode: list?.internalCode,
                    propertyAddress: this.formatAddressForEmail(address),
                    created: pricingCreated,
                    updated: pricingUpdated,
                    currentPrice: primaryHighlight?.currentPrice ?? null,
                    suggestedPrice: primaryHighlight?.suggestedPrice ?? null,
                    liftPercent: primaryHighlight?.liftPercent ?? null,
                    reasons: this.buildPricingDigestReasons(pricingHighlights, pricingCreated, pricingUpdated),
                };
            }
            if (pricingGenerated > 0 || pricingUnchanged === 0) {
                await this.emailService.enviarNotification(address?.user?.id, notificationContent);
            } else {
                this.logger.debug(
                    `Nenhuma notificação criada para list=${listId}; ${pricingUnchanged} sugestões já estavam atualizadas.`,
                );
            }

            return {
                ok: true,
                pricingGenerated,
                pricingCreated,
                pricingUpdated,
                pricingUnchanged,
                pricingFailed,
                pricingSkippedPastEvent,
                pricingSkippedNoCoordinates,
                pricingSkippedEventQuality,
                pricingDuplicateTransportRows,
                pricingCandidates: pricingAnalyses.length,
                failureReasons: pricingFailureReasons,
            };

        } catch (err) {
            console.log("❌ Erro ao buscar endereço ou análises:", err);
            return {
                ok: false,
                reason: err instanceof Error ? err.message : String(err),
                pricingGenerated: 0,
                pricingCreated: 0,
                pricingUpdated: 0,
                pricingFailed: 0,
            };
        }
    }

    private isSamePricingAnalysis(
        existing: AnalisePreco,
        next: {
            distanciaSuaPropriedade: number;
            distanciaPropriedadeReferencia: number;
            precoSugerido: number;
            seuPrecoAtual: number;
            diferencaPercentual: number;
            recomendacao: string;
            motivo_ia?: string | null;
        },
    ) {
        return isSamePricingAnalysis(existing, next);
    }

    private isSameNumber(left: unknown, right: unknown, tolerance = 0.01) {
        return isSameNumber(left, right, tolerance);
    }

    async getPricingPropriedadeByEventAndByProperty(alertAirbId: string, listId: string, eventId: string, dadosAirbnb: FirstAvailablePriceResult, propriedadeReferencia: FirstAvailablePriceResult, alerts: APITypes) {
        try {
            console.log(`🔹 Iniciando processamento de pricing: alertAirbId=${alertAirbId}, listId=${listId}, eventId=${eventId}`);

            //const alerts = await this.buscarAlertPorId("8a2999b68e85e90928bddeb0");
            //  const alerts = await this.buscarAlertPorId(alertAirbId);

            const evento = await this.eventoRepository.findOne({
                where: { id: eventId },
            });
            if (!evento) {
                console.log(`❌ Evento não encontrado: ${eventId}`);
                return { ok: false, reason: 'event_not_found' };
            }

            const property = await this.propriedades.findOne({
                where: { id: listId },
                relations: ['user'],
            });
            if (!property) {
                console.log(`❌ Propriedade não encontrada: ${listId}`);
                return { ok: false, reason: 'property_not_found' };
            }
            if (!property.user?.id) {
                this.logger.warn(`Pricing ignorado para list=${listId}: propriedade sem usuário associado.`);
                return { ok: false, reason: 'property_without_user' };
            }
            if (property.user.ativo === false) {
                this.logger.warn(`Pricing ignorado para list=${listId}: usuário inativo.`);
                return { ok: false, reason: 'inactive_user' };
            }
            if (!property.id_do_anuncio || !String(property.id_do_anuncio).trim()) {
                this.logger.warn(`Pricing ignorado para list=${listId}: propriedade sem id_do_anuncio.`);
                return { ok: false, reason: 'missing_listing_external_id' };
            }
            const pricingGuardrail = this.pricingGuardrailService.resolve(property.user);

            //const dadosAirbnb = await this.airbnbService.getFirstAvailablePrice(property?.id_do_anuncio);
            //const dadosAirbnb = await this.airbnbService.getFirstAvailablePrice(property?.id_do_anuncio);

            const address = await this.addressRepository.findOne({
                where: { list: { id: listId } },
            });

            if (!address) {
                console.log(`❌ Endereço não encontrado para listId: ${listId}`);
                return { ok: false, reason: 'address_not_found' };
            }
            if (!address.list?.id) {
                this.logger.warn(`Pricing ignorado para list=${listId}: endereço sem imóvel associado.`);
                return { ok: false, reason: 'address_without_listing' };
            }

            if (!alerts?.comps?.length) {
                console.log("⚠️ Nenhum comparativo encontrado nos alerts para o cálculo de preço");
                return { ok: false, reason: 'missing_comps' };
            }

            const maxObj = alerts.comps.reduce((prev, curr) =>
                curr.similarity_score > prev.similarity_score ? curr : prev
            );

            console.log("📏 Calculando distâncias entre propriedades e evento...");
            const distanceFromMyPropertyToEvent = await calculateDistance(
                address.latitude,
                address.longitude,
                evento.latitude,
                evento.longitude
            );
            const distanceFromMyPropertyReferenceToEvent = await calculateDistance(
                maxObj.latitude,
                maxObj.longitude,
                evento.latitude,
                evento.longitude
            );

            console.log("📍 Distância minha propriedade:", distanceFromMyPropertyToEvent);
            console.log("📍 Distância propriedade referência:", distanceFromMyPropertyReferenceToEvent);

            const distanciaReferencia = distanceFromMyPropertyReferenceToEvent;
            const distanciaSua = distanceFromMyPropertyToEvent;
            const fatorLocalizacao = Math.min(Math.max(distanciaReferencia / distanciaSua, 0.8), 1.2);
            const minhaPropriedadePricePerDay = getDiaria(dadosAirbnb);
            const PropriedadeReferenciaPricePerDay = getDiaria(propriedadeReferencia);
            const referenceCandidates = [
                Number(PropriedadeReferenciaPricePerDay),
                Number(maxObj.avg_booked_daily_rate_ltm),
            ].filter((price) => Number.isFinite(price) && price > 0);
            const referenceDailyPrice =
                referenceCandidates.length > 0
                    ? referenceCandidates.reduce((sum, price) => sum + price, 0) / referenceCandidates.length
                    : Number(PropriedadeReferenciaPricePerDay);
            const propertyDetails = dadosAirbnb?.propertyDetails as any;
            const myBathrooms =
                Number(propertyDetails?.bathrooms) ||
                Number(propertyDetails?.bathroomCount) ||
                1;
            const referenceBathrooms = Number(maxObj.bathrooms) || 1;
            const publicoEsperado =
                Number(evento.expectedAttendance) ||
                Number(evento.capacidadeEstimada) ||
                Number(evento.venueCapacity) ||
                null;

            // Aqui não considera o preço do imóvel referência, porque o imóvel tem preço extremamente inferior maxObj.avg_booked_daily_rate_ltm.
            const result = this.pricingCalculateService.calcular({
                precoReferencia: Number(referenceDailyPrice),
                seuPrecoAtual: Number(minhaPropriedadePricePerDay),
                capacidadeReferencia: Number(maxObj.bedrooms ?? 1),
                suaCapacidade: Number(propertyDetails?.bedrooms ?? 1),
                banheiroReferencia: referenceBathrooms,
                seuBanheiro: myBathrooms,
                fatorLocalizacao: fatorLocalizacao !== undefined ? Number(fatorLocalizacao) : undefined,
                relevanciaEvento: evento.relevancia,
                publicoEsperado,
                maxReducaoPercent: pricingGuardrail.maxReducaoPercent,
                maxAumentoPercent: pricingGuardrail.maxAumentoPercent,
                // Piso informado pelo anfitrião (plano B do scraping, ADR 0010).
                precoMinimo: this.nullableNumber(property.minDailyPrice),
            });



            console.log("precoReferencia:", Number(maxObj.avg_booked_daily_rate_ltm));
            console.log("seuPrecoAtual:", Number(dadosAirbnb?.price?.data?.accommodationCost));
            console.log("capacidadeReferencia:", Number(maxObj.bedrooms ?? 1));
            console.log("suaCapacidade:", Number(propertyDetails?.bedrooms ?? 1));
            console.log("banheiroReferencia:", Number(maxObj.bathrooms));
            console.log("seuBanheiro:", myBathrooms);
            console.log("fatorLocalizacao:", fatorLocalizacao !== undefined ? Number(fatorLocalizacao) : undefined);

            console.log("💰 Resultado do cálculo de preço (Matemático):", result);

            // --- Tentar Predição via IA (KNN) ---
            let precoFinalSugerido = result.precoSugerido;
            let percentualFinal = result.diferencaPercentual;
            let recomendacaoFinal = result.recomendacao;
            let motivoDaIA = result.motivo;

            try {
                // Treinar a IA dinamicamente usando os comparáveis (Comps) da vizinhança!
                if(alerts.comps && alerts.comps.length > 0) {
                    // F6.1 — Persistir os comps no PriceSnapshot ANTES de usar para treino.
                    // Isso constrói o dataset proprietário Urban AI passivamente:
                    // cada análise gerada = N pontos novos no histórico, sem custo extra.
                    // Disparado em "fire-and-forget" para não atrasar a resposta ao usuário.
                    this.datasetCollector
                        .recordCompsFromAnalysis(
                            alerts.comps.map((c: any) => ({
                                listingID: String(c.listingID),
                                latitude: c.latitude,
                                longitude: c.longitude,
                                bedrooms: c.bedrooms,
                                bathrooms: c.bathrooms,
                                avg_booked_daily_rate_ltm: c.avg_booked_daily_rate_ltm,
                                similarity_score: c.similarity_score,
                            })),
                        )
                        .catch((err) => {
                            console.warn('Falha ao persistir comps em PriceSnapshot:', err?.message);
                        });

                    const treinamentoLocal = alerts.comps.map(c => ({
                        id: c.listingID, lat: c.latitude, lng: c.longitude,
                        metroDistance: 0.8, // Estimativa fixa caso não haja Map API instanciada
                        amenitiesCount: c.bedrooms || 1,
                        // Label: Se é muito parecido (score alto), é premium(2), senao standard(1) ou economico(0)
                        category: c.similarity_score >= 0.8 ? 2 : (c.similarity_score >= 0.5 ? 1 : 0),
                        // Insumo do rótulo v2 (ADR relativo aos comps — ver knn-engine/knn-labels.ts).
                        adr: Number(c.avg_booked_daily_rate_ltm) > 0 ? Number(c.avg_booked_daily_rate_ltm) : null,
                    }));
                    const { labels: rotulosV2 } = deriveKnnLabels(treinamentoLocal);
                    treinamentoLocal.forEach((row: any, i: number) => {
                        row.derivedCategory = rotulosV2[i].category;
                    });
                    // Classificador LOCAL por análise: antes este treino sobrescrevia o
                    // modelo compartilhado do motor (singleton), apagando o treino do
                    // bootstrap e criando corrida entre análises simultâneas. O modelo
                    // legado treinado aqui é idêntico ao anterior, então o v1 não muda.
                    const classificadorLocal = new PropertyClassifier();
                    classificadorLocal.train(treinamentoLocal);
                    const pricingMode = resolvePricingEngineMode();

                    const minhaPropParaIA = {
                        id: property.id, lat: address.latitude, lng: address.longitude,
                        // IA-1: usa a feature real quando o FeatureEngineeringService já
                        // populou (address.metroDistance / list.amenitiesCount); senão cai
                        // no fallback antigo, sem regressão.
                        metroDistance: (address as any)?.metroDistance ?? 0.5,
                        amenitiesCount: (address as any)?.list?.amenitiesCount ?? propertyDetails?.bedrooms ?? 1
                    };
                    const eventoParaIA = {
                        name: evento.nome || "Evento", lat: evento.latitude, lng: evento.longitude
                    };

                    const contextoV2 = pricingMode === 'v1'
                        ? {}
                        : await this.loadPricingContextV2(address, evento.dataInicio);
                    const prediCaaaoIA = await this.aiEngine.suggestPrice(minhaPropParaIA, eventoParaIA, Number(minhaPropriedadePricePerDay), {
                        ...contextoV2,
                        classifier: classificadorLocal,
                        eventV2: {
                            ...eventoParaIA,
                            relevancia: evento.relevancia,
                            venueCapacity: evento.venueCapacity,
                            expectedAttendance: evento.expectedAttendance,
                            dataInicio: evento.dataInicio,
                        },
                        targetDate: evento.dataInicio,
                        distanceKm: Number(distanceFromMyPropertyToEvent),
                        guardrail: {
                            maxDecreasePercent: pricingGuardrail.maxReducaoPercent,
                            maxIncreasePercent: pricingGuardrail.maxAumentoPercent,
                        },
                    });

                    if(prediCaaaoIA && prediCaaaoIA.suggestedPrice) {
                        precoFinalSugerido = pricingMode === 'v2'
                            // v2: média do cálculo ancorado no mercado com o motor v2 — ambos podem
                            // ficar abaixo da base; o antigo Math.max impedia qualquer redução.
                            ? Number(((prediCaaaoIA.suggestedPrice + result.precoSugerido) / 2).toFixed(2))
                            : Math.max(prediCaaaoIA.suggestedPrice, result.precoSugerido); // v1: maior dos dois (só sobe)
                        percentualFinal = Number((((precoFinalSugerido - result.seuPrecoAtual) / result.seuPrecoAtual) * 100).toFixed(1));
                        recomendacaoFinal = (percentualFinal > 0)
                            ? "Aumento de Receita Sugerido (IA)"
                            : (pricingMode === 'v2' && percentualFinal < -5)
                                ? "Redução Sugerida para Ocupação (IA)"
                                : "Manutenção de Fator de Ocupação (IA)";
                        motivoDaIA = prediCaaaoIA.details.reasoning;
                        console.log(`🤖 IA KNN Ativada! Predição original KNN: R$${prediCaaaoIA.suggestedPrice} (+${percentualFinal}%). Motivo: ${motivoDaIA}`);
                    }
                }
            } catch (err) {
                console.error("⚠️ Falha ao predizer preço via IA (Falta de Histórico/Atributos). Acionando Fallback Matemático Integralmente:", err.message);
            }

            const maxAllowedFinalPrice = result.seuPrecoAtual * pricingGuardrail.maxMultiplier;
            const minAllowedFinalPrice = result.seuPrecoAtual * pricingGuardrail.minMultiplier;
            const boundedFinalPrice = Math.min(Math.max(precoFinalSugerido, minAllowedFinalPrice), maxAllowedFinalPrice);
            const guardrailDescription = this.pricingGuardrailService.describe(pricingGuardrail);

            if (boundedFinalPrice !== precoFinalSugerido) {
                precoFinalSugerido = Number(boundedFinalPrice.toFixed(2));
                percentualFinal = Number((((precoFinalSugerido - result.seuPrecoAtual) / result.seuPrecoAtual) * 100).toFixed(1));
                recomendacaoFinal =
                    percentualFinal > 15
                        ? 'AUMENTAR (preço abaixo do mercado/evento)'
                        : percentualFinal > 5
                            ? 'Pode aumentar'
                            : Math.abs(percentualFinal) <= 5
                                ? 'Manter'
                                : 'Reduzir levemente (preço acima do sugerido)';
                motivoDaIA = `${motivoDaIA ?? ''} Guardrail aplicado: sugestão limitada pelo ${guardrailDescription}.`;
            } else {
                motivoDaIA = `${motivoDaIA ?? ''} Guardrail ativo: ${guardrailDescription}.`;
            }

            const existingAnalise = await this.analisePrecoRepository.findOne({
                where: {
                    endereco: { id: address.id },
                    evento: { id: evento.id },
                    usuarioProprietario: { id: property?.user?.id },
                },
            });
            const nextAnalise = {
                endereco: address,
                evento: evento,
                usuarioProprietario: property?.user ?? null,
                distanciaSuaPropriedade: distanceFromMyPropertyToEvent,
                distanciaPropriedadeReferencia: distanceFromMyPropertyReferenceToEvent,
                precoSugerido: precoFinalSugerido,
                seuPrecoAtual: result.seuPrecoAtual,
                diferencaPercentual: percentualFinal,
                recomendacao: recomendacaoFinal,
                motivo_ia: motivoDaIA,
            };

            if (existingAnalise && this.isSamePricingAnalysis(existingAnalise, nextAnalise)) {
                console.log("Análise de preço já estava atualizada");
                return {
                    ok: true,
                    id: existingAnalise.id,
                    updated: false,
                    unchanged: true,
                    precoSugerido: precoFinalSugerido,
                    diferencaPercentual: percentualFinal,
                    eventName: evento.nome,
                    eventDate: this.formatEventDateForEmail(evento.dataInicio),
                    eventLocation: [evento.cidade, evento.estado].filter(Boolean).join(' - '),
                    distanceKm: distanceFromMyPropertyToEvent,
                    relevance: evento.relevancia,
                    expectedAttendance: publicoEsperado,
                    currentPrice: result.seuPrecoAtual,
                    suggestedPrice: precoFinalSugerido,
                    liftPercent: percentualFinal,
                    recommendation: recomendacaoFinal,
                    reason: motivoDaIA,
                };
            }

            // --- Salvar no banco ---
            console.log("💾 Salvando análise de preço...");
            const savedAnalise = await this.analisePrecoRepository.save({
                ...(existingAnalise ? { id: existingAnalise.id } : {}),
                ...nextAnalise,
            });
            console.log("Análise de preço salva com sucesso");
            return {
                ok: true,
                id: savedAnalise.id,
                updated: Boolean(existingAnalise),
                precoSugerido: precoFinalSugerido,
                diferencaPercentual: percentualFinal,
                eventName: evento.nome,
                eventDate: this.formatEventDateForEmail(evento.dataInicio),
                eventLocation: [evento.cidade, evento.estado].filter(Boolean).join(' - '),
                distanceKm: distanceFromMyPropertyToEvent,
                relevance: evento.relevancia,
                expectedAttendance: publicoEsperado,
                currentPrice: result.seuPrecoAtual,
                suggestedPrice: precoFinalSugerido,
                liftPercent: percentualFinal,
                recommendation: recomendacaoFinal,
                reason: motivoDaIA,
            };

        } catch (err) {
            console.log(`❌ Erro no processamento de pricing para alertAirbId=${alertAirbId}, eventId=${eventId}:`, err);
            return {
                ok: false,
                reason: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * Contexto do motor v2: regras do imóvel (`PricingRuleConfig`; sem config →
     * defaults do painel) e ocupação da noite e vizinhas (`OccupancyHistory`).
     * Best-effort: qualquer falha devolve contexto vazio (v2 usa defaults).
     */
    private async loadPricingContextV2(address: Address, targetDate: unknown): Promise<PricingContextV2> {
        const context: PricingContextV2 = {};
        try {
            const config = await this.pricingRuleConfigRepository?.findOne({ where: { address: { id: address.id } } });
            if (Array.isArray(config?.rules)) context.rules = config.rules;
        } catch (err) {
            this.logger.warn(`Regras de pricing indisponíveis para address=${address.id}: ${(err as Error).message}`);
        }
        const dateKey = toDayKey(targetDate as any);
        const listId = address.list?.id;
        if (dateKey && listId && this.occupancyHistoryRepository) {
            try {
                const rows = await this.occupancyHistoryRepository.find({
                    where: {
                        list: { id: listId },
                        date: Between(addDaysToDateKey(dateKey, -1), addDaysToDateKey(dateKey, 1)),
                    } as any,
                });
                const booked = (key: string) =>
                    rows.some((r) => String(r.date).slice(0, 10) === key && r.status === 'booked');
                context.occupancy = {
                    prevNightBooked: booked(addDaysToDateKey(dateKey, -1)),
                    targetNightBooked: booked(dateKey),
                    nextNightBooked: booked(addDaysToDateKey(dateKey, 1)),
                };
            } catch (err) {
                this.logger.warn(`Ocupação indisponível para list=${listId}: ${(err as Error).message}`);
            }
        }
        return context;
    }

    private async buildDirectScrapingComps(
        address: Address,
        list: List,
        dadosAirbnb: FirstAvailablePriceResult,
    ): Promise<APITypes | null> {
        const targetPrice = Number(getDiaria(dadosAirbnb));
        const targetDetails = dadosAirbnb?.propertyDetails as any;
        const comps: any[] = [];

        const candidates = await this.addressRepository.find({
            where: { ativo: true },
            relations: ['list', 'user'],
            take: 50,
        });

        const targetExternalId = String(list?.id_do_anuncio ?? '').trim();
        const targetUserRole = this.normalizeRole((address?.user as any)?.role ?? (list as any)?.user?.role);
        const protectHostPricing = targetUserRole === 'host';
        const nearby = [];
        for (const candidate of candidates) {
            if (!candidate?.list?.id_do_anuncio || candidate.list.id === list.id) continue;
            const candidateExternalId = String(candidate.list.id_do_anuncio ?? '').trim();
            if (targetExternalId && candidateExternalId === targetExternalId) continue;
            const candidateUser = candidate.user ?? (candidate.list as any)?.user;
            if (candidateUser?.ativo === false || (candidate.list as any)?.user?.ativo === false) continue;
            const candidateRole = this.normalizeRole(candidateUser?.role ?? (candidate.list as any)?.user?.role);
            if (protectHostPricing && candidateRole !== 'host') continue;
            if (!candidate.latitude || !candidate.longitude || !address.latitude || !address.longitude) continue;
            const distanceKm = await calculateDistance(
                Number(address.latitude),
                Number(address.longitude),
                Number(candidate.latitude),
                Number(candidate.longitude),
            );
            if (distanceKm <= 10) nearby.push({ candidate, distanceKm });
        }

        nearby.sort((a, b) => a.distanceKm - b.distanceKm);

        for (const { candidate, distanceKm } of nearby.slice(0, 5)) {
            let dailyPrice = this.resolveStoredDailyPrice(candidate.list);
            let details: any = null;
            if (!dailyPrice) {
                try {
                    const quote = await this.airbnbService.getFirstAvailablePrice(candidate.list.id_do_anuncio);
                    dailyPrice = Number(getDiaria(quote));
                    details = quote.propertyDetails as any;
                } catch (error) {
                    this.logger.warn(
                        `Fallback comps: sem preço para listing=${candidate.list.id_do_anuncio}: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    );
                }
            }
            if (!dailyPrice || dailyPrice <= 0) continue;
            comps.push(this.toDirectComp(candidate, dailyPrice, details, distanceKm));
        }

        if (comps.length === 0 && targetPrice > 0) {
            comps.push(this.toDirectComp(address, targetPrice, targetDetails, 0));
        }

        if (comps.length === 0) return null;

        return {
            id: `direct-${address.id}`,
            latitude: Number(address.latitude),
            longitude: Number(address.longitude),
            bedrooms: Number(targetDetails?.bedrooms ?? list.quartos ?? 1),
            bathrooms: Number(targetDetails?.bathrooms ?? list.banheiros ?? 1),
            accommodates: Number(targetDetails?.guestMaximum ?? list.hospedes ?? 1),
            created_at: new Date(),
            radius: 10,
            comps_status: 'direct_scraping_fallback',
            comps,
            kpis: {} as any,
        };
    }

    private async getPricingBaseQuote(list: List): Promise<FirstAvailablePriceResult> {
        const storedPrice = this.resolveStoredDailyPrice(list);
        if (storedPrice && storedPrice > 0) {
            return this.buildManualPriceQuote(storedPrice, {
                bedrooms: Number(list?.quartos ?? 1),
                beds: Number(list?.camas ?? 1),
                guestMaximum: Number(list?.hospedes ?? 1),
            });
        }

        return this.airbnbService.getFirstAvailablePrice(list?.id_do_anuncio);
    }

    private buildManualPriceQuote(
        dailyPrice: number,
        details: { bedrooms?: number; beds?: number; guestMaximum?: number },
    ): FirstAvailablePriceResult {
        return buildManualPriceQuote(dailyPrice, details);
    }

    private toDirectComp(address: Address, dailyPrice: number, details: any, distanceKm: number): any {
        return toDirectComp(address, dailyPrice, details, distanceKm);
    }

    private resolveStoredDailyPrice(list: List): number | null {
        return resolveStoredDailyPrice(list);
    }

    private normalizeRole(value: unknown): string {
        return normalizeRole(value);
    }

    getPricingEventQualityFlags(evento: EventEntity | null | undefined, now = new Date()): string[] {
        return getPricingEventQualityFlags(evento, now);
    }

    private nullableNumber(value: unknown): number | null {
        return nullableNumber(value);
    }
}
