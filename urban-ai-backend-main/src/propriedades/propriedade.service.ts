import { BadRequestException, forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Address } from 'src/entities/addresses.entity';
import { Between, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { AirbnbQuoteResponse } from './types/types';
import { List } from 'src/entities/list.entity';
import { ApiProperty } from '@nestjs/swagger';
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
import { PropertyCoordinatesDto } from './tdo/property-coordinates.dto';
import { FirstAvailablePriceResult } from 'src/airbnb/types';
import dayjs from 'dayjs';
import { addDays, startOfDay, startOfMonth } from 'date-fns';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';
import { UrbanAIPricingEngine } from '../knn-engine/pricing-engine';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { PricingInputHistory } from 'src/entities/pricing-input-history.entity';
import { PricingGuardrailService } from './pricing-guardrail.service';
import { MailerService } from 'src/mailer/mailer.service';
import { OccupancyHistory } from 'src/entities/occupancy-history.entity';
import { AirbnbListingMetadataService } from './airbnb-listing-metadata.service';
import {
    PublicListResponse,
    PublicAddressResponse,
    PublicPropertySetupStatus,
    PricingNotificationHighlight,
    nullableNumber,
    isSameNumber,
    sameMoney,
    dateOnly,
    extractNumber,
    extractMetaContent,
    decodeHtmlEntities,
    extractHostIdFromAirbnbHtml,
    compactText,
    formatMoney,
    formatEventDateForEmail,
    formatSuggestionCount,
    normalizeRole,
    normalizeOptionalText,
    normalizeOptionalMoney,
    normalizeOptionalInteger,
    normalizeDateOnly,
    normalizeOccupancyStatus,
    hasUsableCoordinates,
    formatLocationLabel,
    formatAddressLine,
    formatAddressForEmail,
    toPublicOccupancyRecord,
    toPublicList,
    toPublicAddress,
    buildPublicPropertySetupStatus,
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

class PropertyResponseDto {
    bedrooms: number;
    beds: number;
    guestMaximum: number;
}

export class CreateAlertDto {
    @ApiProperty({ example: 12.9713964, description: 'Latitude do imóvel' })
    latitude: number;

    @ApiProperty({ example: 77.5979991, description: 'Longitude do imóvel' })
    longitude: number;

    @ApiProperty({ example: 2, description: 'Número de quartos' })
    bedrooms: number;

    @ApiProperty({ example: 2, description: 'Número de banheiros' })
    bathrooms: number;

    @ApiProperty({ example: 4, description: 'Número de hóspedes que acomoda' })
    accommodates: number;
}


@Injectable()
export class PropriedadeService {
    private readonly logger = new Logger(PropriedadeService.name);

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
        @InjectRepository(PricingInputHistory)
        private readonly pricingInputHistoryRepository: Repository<PricingInputHistory>,
        @InjectRepository(OccupancyHistory)
        private readonly occupancyHistoryRepository: Repository<OccupancyHistory>,
        @Inject(forwardRef(() => AirbnbService))
        private readonly airbnbService: AirbnbService,
        private readonly emailService: EmailService,
        private readonly mailerService: MailerService,
        private readonly aiEngine: UrbanAIPricingEngine,
        private readonly datasetCollector: DatasetCollectorService,
        private readonly pricingGuardrailService: PricingGuardrailService,
        private readonly airbnbListingMetadataService: AirbnbListingMetadataService,
    ) { }

    async findByUserId(
        userId: string,
        page = 1,
        limit = 10
    ): Promise<{ data: PublicAddressResponse[]; total: number; page: number; limit: number }> {
        const [data, total] = await this.addressRepository.findAndCount({
            where: { user: { id: userId }, ativo: true, list: { ativo: true } },
            relations: ['list'],
            skip: (page - 1) * limit,
            take: limit,
            order: { created_at: 'DESC' },
        });

        return { data: data.map((address) => this.toPublicAddress(address)), total, page, limit };
    }

    async findAddressById(id: string, userId: string): Promise<PublicAddressResponse | null> {
        const address = await this.addressRepository.findOne({
            where: { id, user: { id: userId } },
            relations: ["list", "user"],
        });
        return address ? this.toPublicAddress(address) : null;
    }

    async deleteAddressAndList(addressId: string, userId: string): Promise<void> {
        // 1. Buscar o endereço pelo ID e dono autenticado (junto com o list relacionado)
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ["list"],
        });

        if (!address) {
            throw new NotFoundException("Endereço não encontrado");
        }

        const listId = address.list?.id;

        // 2. Deletar o endereço primeiro (filho)
        await this.addressRepository.delete(address.id);

        // 3. Verificar se ainda existem outros endereços ligados ao mesmo list
        const remainingAddresses = await this.addressRepository.count({
            where: { list: { id: listId } },
        });

        // 4. Se não houver mais endereços ligados, deletar o list também
        if (remainingAddresses === 0 && listId) {
            await this.propriedades.delete(listId);
        }
    }

    async findPropertiesForDropdown(
        userId: string
    ): Promise<{
        id: string;
        propertyName: string;
        userId: string;
        latitude: number;
        longitude: number;
        manualDailyPrice: number | null;
        averageMonthlyRevenue: number | null;
        dailyPrice: number | null;
        pricingInputSource: string | null;
        pricingInputsUpdatedAt: Date | null;
        internalNickname: string | null;
        internalCode: string | null;
        cep: string | null;
        numero: string | null;
        logradouro: string | null;
        bairro: string | null;
        cidade: string | null;
        estado: string | null;
        addressLine: string | null;
        locationLabel: string | null;
        setupStatus: PublicPropertySetupStatus;
    }[]> {
        // Busca específica pelo userId fornecido
        const addresses = await this.addressRepository.find({
            where: { user: { id: userId }, ativo: true, list: { ativo: true } },
            relations: ['list'],
            select: ['id', 'cep', 'numero', 'logradouro', 'bairro', 'cidade', 'estado', 'analisado', 'latitude', 'longitude']
        });

        return addresses.map(address => ({
            latitude: address?.latitude,
            longitude: address?.longitude,
            id: address.id,
            propertyName: address.list?.titulo || `Propriedade sem nome (${address.id.substring(0, 4)})`,
            image_url: address.list?.pictureUrl,
            userId: userId,
            analisado: address?.analisado,
            id_do_anuncio: address.list?.id_do_anuncio,
            internalNickname: address.list?.internalNickname ?? null,
            internalCode: address.list?.internalCode ?? null,
            manualDailyPrice: address.list?.manualDailyPrice ?? null,
            averageMonthlyRevenue: address.list?.averageMonthlyRevenue ?? null,
            dailyPrice: address.list?.dailyPrice ?? null,
            pricingInputSource: address.list?.pricingInputSource ?? null,
            pricingInputsUpdatedAt: address.list?.pricingInputsUpdatedAt ?? null,
            cep: address.cep ?? null,
            numero: address.numero ?? null,
            logradouro: address.logradouro ?? null,
            bairro: address.bairro ?? address.list?.neighborhood ?? null,
            cidade: address.cidade ?? null,
            estado: address.estado ?? null,
            addressLine: this.formatAddressLine(address),
            locationLabel: this.formatLocationLabel(address),
            setupStatus: this.buildPublicPropertySetupStatus(address),
        }));

    }

    private buildPublicPropertySetupStatus(address: Address): PublicPropertySetupStatus {
        return buildPublicPropertySetupStatus(address);
    }

    private hasUsableCoordinates(address: Address): boolean {
        return hasUsableCoordinates(address);
    }

    async updateIdentity(
        addressId: string,
        userId: string,
        input: { internalNickname?: string | null; internalCode?: string | null },
    ) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        address.list.internalNickname = this.normalizeOptionalText(input.internalNickname, 'internalNickname', 80);
        address.list.internalCode = this.normalizeOptionalText(input.internalCode, 'internalCode', 32);

        const saved = await this.propriedades.save(address.list);

        return {
            addressId,
            listId: saved.id,
            internalNickname: saved.internalNickname ?? null,
            internalCode: saved.internalCode ?? null,
        };
    }

    async updatePricingInputs(
        addressId: string,
        userId: string,
        input: { manualDailyPrice?: number | null; averageMonthlyRevenue?: number | null },
    ) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        const manualDailyPrice = this.normalizeOptionalMoney(input.manualDailyPrice, 'manualDailyPrice');
        const averageMonthlyRevenue = this.normalizeOptionalMoney(input.averageMonthlyRevenue, 'averageMonthlyRevenue');
        const previousManualDailyPrice = address.list.manualDailyPrice ?? null;
        const previousAverageMonthlyRevenue = address.list.averageMonthlyRevenue ?? null;

        address.list.manualDailyPrice = manualDailyPrice;
        address.list.averageMonthlyRevenue = averageMonthlyRevenue;
        address.list.pricingInputSource = manualDailyPrice ? 'manual' : null;
        address.list.pricingInputsUpdatedAt = new Date();

        if (manualDailyPrice) {
            address.list.dailyPrice = manualDailyPrice;
            address.list.raw = manualDailyPrice;
            address.list.currency = 'BRL';
            address.list.priceText = `R$${manualDailyPrice.toFixed(2)}`;
        }

        const saved = await this.propriedades.save(address.list);
        await this.recordPricingInputHistory({
            address,
            list: saved,
            userId,
            previousManualDailyPrice,
            newManualDailyPrice: saved.manualDailyPrice ?? null,
            previousAverageMonthlyRevenue,
            newAverageMonthlyRevenue: saved.averageMonthlyRevenue ?? null,
        });

        return {
            addressId,
            listId: saved.id,
            manualDailyPrice: saved.manualDailyPrice ?? null,
            averageMonthlyRevenue: saved.averageMonthlyRevenue ?? null,
            dailyPrice: saved.dailyPrice ?? null,
            pricingInputSource: saved.pricingInputSource ?? null,
            pricingInputsUpdatedAt: saved.pricingInputsUpdatedAt ?? null,
        };
    }

    async getPricingInputHistory(addressId: string, userId: string, limit = 20) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
        return this.pricingInputHistoryRepository.find({
            where: { list: { id: address.list.id }, user: { id: userId } },
            order: { createdAt: 'DESC' },
            take: safeLimit,
        });
    }

    async getOccupancyHistory(
        addressId: string,
        userId: string,
        input?: { from?: string; to?: string; limit?: number },
    ) {
        const address = await this.findOwnedAddressWithList(addressId, userId);
        const today = new Date();
        const defaultFrom = this.dateOnly(addDays(today, -30));
        const defaultTo = this.dateOnly(addDays(today, 60));
        const from = this.normalizeDateOnly(input?.from, 'from') ?? defaultFrom;
        const to = this.normalizeDateOnly(input?.to, 'to') ?? defaultTo;
        const safeLimit = Math.min(Math.max(Number(input?.limit) || 120, 1), 240);

        const records = await this.occupancyHistoryRepository.find({
            where: {
                user: { id: userId },
                list: { id: address.list.id },
                date: Between(from, to),
            },
            order: { date: 'DESC' },
            take: safeLimit,
        });

        return records.map((record) => this.toPublicOccupancyRecord(record));
    }

    async upsertManualOccupancy(
        addressId: string,
        userId: string,
        input: {
            date?: string;
            status?: 'booked' | 'available' | 'blocked' | 'unknown';
            revenue?: number | null;
            listedPrice?: number | null;
            nightsBooked?: number | null;
        },
    ) {
        const address = await this.findOwnedAddressWithList(addressId, userId);
        const date = this.normalizeDateOnly(input?.date, 'date');
        if (!date) {
            throw new HttpException('date e obrigatorio no formato YYYY-MM-DD', HttpStatus.BAD_REQUEST);
        }

        const status = this.normalizeOccupancyStatus(input?.status);
        const revenue = this.normalizeOptionalMoney(input?.revenue, 'revenue');
        const listedPrice = this.normalizeOptionalMoney(input?.listedPrice, 'listedPrice');
        const nightsBooked = this.normalizeOptionalInteger(input?.nightsBooked, 'nightsBooked');

        const existing = await this.occupancyHistoryRepository.findOne({
            where: { list: { id: address.list.id }, date },
        });
        const record = existing ?? this.occupancyHistoryRepository.create();

        record.date = date;
        record.list = address.list;
        record.address = address;
        record.user = { id: userId } as User;
        record.status = status;
        record.revenueCents = revenue == null ? null : Math.round(revenue * 100);
        record.listedPriceCents = listedPrice == null ? null : Math.round(listedPrice * 100);
        record.currency = 'BRL';
        record.origin = 'manual';
        record.externalReservationId = null;
        record.nightsBooked = status === 'booked' ? nightsBooked ?? 1 : nightsBooked;
        record.trainingReady = status === 'booked' || status === 'available';

        const saved = await this.occupancyHistoryRepository.save(record);
        return this.toPublicOccupancyRecord(saved);
    }

    private async recordPricingInputHistory(input: {
        address: Address;
        list: List;
        userId: string;
        previousManualDailyPrice: number | null;
        newManualDailyPrice: number | null;
        previousAverageMonthlyRevenue: number | null;
        newAverageMonthlyRevenue: number | null;
    }): Promise<void> {
        const changed =
            !this.sameMoney(input.previousManualDailyPrice, input.newManualDailyPrice) ||
            !this.sameMoney(input.previousAverageMonthlyRevenue, input.newAverageMonthlyRevenue);

        if (!changed) return;

        await this.pricingInputHistoryRepository.save(
            this.pricingInputHistoryRepository.create({
                address: input.address,
                list: input.list,
                user: { id: input.userId } as User,
                previousManualDailyPrice: input.previousManualDailyPrice,
                newManualDailyPrice: input.newManualDailyPrice,
                previousAverageMonthlyRevenue: input.previousAverageMonthlyRevenue,
                newAverageMonthlyRevenue: input.newAverageMonthlyRevenue,
                source: 'manual',
                changedByUserId: input.userId,
            }),
        );
    }

    private sameMoney(a: number | null, b: number | null): boolean {
        return sameMoney(a, b);
    }

    private async findOwnedAddressWithList(addressId: string, userId: string): Promise<Address & { list: List }> {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        return address as Address & { list: List };
    }

    private normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null {
        return normalizeOptionalText(value, field, maxLength);
    }

    private normalizeOptionalMoney(value: unknown, field: string): number | null {
        return normalizeOptionalMoney(value, field);
    }

    private normalizeOptionalInteger(value: unknown, field: string): number | null {
        return normalizeOptionalInteger(value, field);
    }

    private normalizeDateOnly(value: unknown, field: string): string | null {
        return normalizeDateOnly(value, field);
    }

    private normalizeOccupancyStatus(value: unknown): 'booked' | 'available' | 'blocked' | 'unknown' {
        return normalizeOccupancyStatus(value);
    }

    private toPublicOccupancyRecord(record: OccupancyHistory) {
        return toPublicOccupancyRecord(record);
    }

    private dateOnly(value: Date): string {
        return dateOnly(value);
    }

    private formatAddressLine(address: Address): string | null {
        return formatAddressLine(address);
    }

    private formatLocationLabel(address: Address): string | null {
        return formatLocationLabel(address);
    }

    private toPublicAddress(address: Address): PublicAddressResponse {
        return toPublicAddress(address);
    }

    private toPublicList(list: List): PublicListResponse {
        return toPublicList(list);
    }

    private nullableNumber(value: unknown): number | null {
        return nullableNumber(value);
    }

    // Hash do GraphQL lida do .env (AIRBNB_GRAPHQL_HASH) com fallback para o valor padrão conhecido
    private static readonly GRAPHQL_DEFAULT_HASH = 'cc10d90fbc2db4f1d74d42017017066b854e382f29d1273f32b6588d6ae25494';

    private get graphqlActiveHash(): string {
        return process.env.AIRBNB_GRAPHQL_HASH || PropriedadeService.GRAPHQL_DEFAULT_HASH;
    }

    // Flag para evitar spam de notificações — só notifica 1x por ciclo de vida do servidor
    private static hashExpirationNotified = false;

    /**
     * Busca os imóveis de um anfitrião via API GraphQL interna do Airbnb.
     * Usa o endpoint ContextualPublicProfileQuery que é a mesma chamada
     * que o site faz no browser para popular o carrossel de acomodações.
     * Hash lida da variável de ambiente AIRBNB_GRAPHQL_HASH.
     * Se expirar, notifica o admin via e-mail.
     */
    async scrapeHostListings(userId: string): Promise<{
        roomId: string; title: string; pictureUrl: string;
    }[]> {
        // A API do Airbnb espera o userId codificado em Base64 no formato "ContextualUser:{id}"
        const encodedUserId = Buffer.from(`ContextualUser:${userId}`).toString('base64');

        // Hash lido do .env a cada chamada (permite hot-reload sem redeploy se o Railway atualizar)
        const queryHash = this.graphqlActiveHash;
        const apiKey = 'd306zoyjsyarp7ifhu67rjxn52tv0t20';

        // Variables corretos conforme interceptação real do browser
        const variables = {
            contextualUserId: encodedUserId,
            viewerUserId: '',
            isViewerLoggedIn: false,
        };

        const extensions = {
            persistedQuery: {
                version: 1,
                sha256Hash: queryHash,
            },
        };

        const url = `https://www.airbnb.com.br/api/v3/ContextualPublicProfileQuery/${queryHash}`;

        // Headers obrigatórios — sem x-airbnb-graphql-platform a API rejeita a query
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'x-airbnb-api-key': apiKey,
            'x-airbnb-graphql-platform': 'web',
            'x-airbnb-graphql-platform-client': 'minimalist-niobe',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        };

        try {
            console.log('[scrapeHost] Buscando listings via GraphQL API.');

            const response = await axios.get(url, {
                headers,
                params: {
                    operationName: 'ContextualPublicProfileQuery',
                    locale: 'pt-BR',
                    currency: 'BRL',
                    variables: JSON.stringify(variables),
                    extensions: JSON.stringify(extensions),
                },
                timeout: 20000,
            });

            if (response.status !== 200) {
                console.warn(`⚠️ [scrapeHost] API retornou status ${response.status}`);
                throw new Error(`Invalid status: ${response.status}`);
            }

            const data = response.data;

            // Se o GraphQL responder com erro de query expirada, notifica o admin
            if (data.errors && data.errors.some((e: any) =>
                (e.extensions?.response?.statusCode === 400 && e.message === 'PersistedQueryNotFound') ||
                e.message?.includes('PersistedQueryNotFound')
            )) {
                console.error(`🚨 [scrapeHost] AIRBNB HASH EXPIRADA! A hash "${queryHash?.substring(0, 12)}..." não é mais válida. Atualize a variável AIRBNB_GRAPHQL_HASH no Railway.`);

                // Notifica o admin por e-mail (apenas 1x por ciclo de vida do servidor)
                if (!PropriedadeService.hashExpirationNotified) {
                    PropriedadeService.hashExpirationNotified = true;
                    this.notifyAdminHashExpired(queryHash).catch(err =>
                        console.error('❌ [scrapeHost] Falha ao notificar admin:', err.message)
                    );
                }

                return [];
            }

            const results: { roomId: string; title: string; pictureUrl: string }[] = [];

            // Estrutura real: data.data.contextualUser.staySupplyListings.edges[].node
            // Os IDs são Base64 no formato Relay: "StaySupplyListing:{roomId}"
            const edges = data?.data?.contextualUser?.staySupplyListings?.edges;

            if (Array.isArray(edges) && edges.length > 0) {
                for (const edge of edges) {
                    const node = edge?.node;
                    if (!node?.id) continue;

                    // Decodifica o ID Base64 Relay → extrair o roomId numérico
                    let roomId: string;
                    try {
                        const decoded = Buffer.from(node.id, 'base64').toString('utf8');
                        // Formato: "StaySupplyListing:1500322322785854842"
                        roomId = decoded.replace(/^StaySupplyListing:/, '');
                    } catch {
                        roomId = node.id;
                    }

                    // name/pictureUrl vêm vazios no nível do node, mas extraímos o que houver
                    const title = node.name || node.title || `Imóvel ${roomId}`;
                    const pictureUrl = node.pictureUrl || node.picture || '';

                    results.push({
                        roomId: String(roomId),
                        title: String(title),
                        pictureUrl: String(pictureUrl),
                    });
                }
            }

            // Fallback genérico: se staySupplyListings vazio, busca em experienceListings ou serviceListings
            if (results.length === 0) {
                const browserFallback = await this.scrapeHostListingsWithBrowserFallback(userId, 'graphql-empty');
                if (browserFallback.length > 0) return browserFallback;
                const user = data?.data?.contextualUser;
                for (const field of ['experienceListings', 'serviceListings']) {
                    const conn = user?.[field];
                    if (conn?.edges && Array.isArray(conn.edges)) {
                        for (const edge of conn.edges) {
                            const node = edge?.node;
                            if (!node?.id) continue;
                            let roomId: string;
                            try {
                                const decoded = Buffer.from(node.id, 'base64').toString('utf8');
                                roomId = decoded.replace(/^[^:]+:/, '');
                            } catch {
                                roomId = node.id;
                            }
                            results.push({
                                roomId: String(roomId),
                                title: node.name || `Imóvel ${roomId}`,
                                pictureUrl: node.pictureUrl || '',
                            });
                        }
                    }
                }
            }

            if (results.length === 0) {
                console.warn('[scrapeHost] Nenhum imóvel encontrado.');
                return [];
            }

            console.log('[scrapeHost] Listings encontrados.');
            return results;

        } catch (err: any) {
            console.error(`❌ [scrapeHost] Erro ao buscar listings via GraphQL (.com.br):`, err.message);

            // Fallback: tenta domínio .com internacional antes de desistir
            const intlResults = await this.scrapeHostListingsFallbackInternational(userId, queryHash, apiKey, variables, extensions, headers);
            if (intlResults.length > 0) return intlResults;
            return this.scrapeHostListingsWithBrowserFallback(userId, 'graphql-error');
        }
    }

    /**
     * Fallback #1: tenta o domínio internacional (.com) caso o .com.br falhe.
     * Ambos os domínios usam a mesma API, mas podem ter políticas de rate-limit diferentes.
     */
    private async scrapeHostListingsFallbackInternational(
        userId: string,
        queryHash: string,
        apiKey: string,
        variables: any,
        extensions: any,
        headers: any,
    ): Promise<{ roomId: string; title: string; pictureUrl: string }[]> {
        try {
            const urlIntl = `https://www.airbnb.com/api/v3/ContextualPublicProfileQuery/${queryHash}`;
            console.log('[scrapeHost:fallback-intl] Tentando domínio alternativo.');

            const response = await axios.get(urlIntl, {
                headers,
                params: {
                    operationName: 'ContextualPublicProfileQuery',
                    locale: 'pt-BR',
                    currency: 'BRL',
                    variables: JSON.stringify(variables),
                    extensions: JSON.stringify(extensions),
                },
                timeout: 20000,
            });

            const data = response.data;
            const edges = data?.data?.contextualUser?.staySupplyListings?.edges;
            if (Array.isArray(edges) && edges.length > 0) {
                const results = edges.map((edge: any) => {
                    const node = edge?.node;
                    if (!node?.id) return null;
                    let roomId: string;
                    try {
                        const decoded = Buffer.from(node.id, 'base64').toString('utf8');
                        roomId = decoded.replace(/^StaySupplyListing:/, '');
                    } catch {
                        roomId = node.id;
                    }
                    return {
                        roomId: String(roomId),
                        title: node.name || `Imóvel ${roomId}`,
                        pictureUrl: node.pictureUrl || '',
                    };
                }).filter(Boolean);

                console.log(`✅ [scrapeHost:fallback-intl] Encontrados ${results.length} imóveis via .com`);
                return results;
            }

            console.warn(`⚠️ [scrapeHost:fallback-intl] Nenhum imóvel encontrado via .com`);
            return [];
        } catch (err: any) {
            console.error(`❌ [scrapeHost:fallback-intl] Falha no domínio .com: ${err.message}`);
            return [];
        }
    }

    private async scrapeHostListingsWithBrowserFallback(
        userId: string,
        _reason: string,
    ): Promise<{ roomId: string; title: string; pictureUrl: string }[]> {
        try {
            console.warn('[scrapeHost:headless] Tentando fallback browser.');
            const listings = await this.airbnbService.scrapeHostListingsWithBrowser(userId);
            if (listings.length === 0) {
                console.warn('[scrapeHost:headless] Nenhum imóvel encontrado via browser.');
                return [];
            }

            console.log('[scrapeHost:headless] Listings encontrados via browser.');
            return listings.map((item) => ({
                roomId: item.roomId,
                title: item.title,
                pictureUrl: item.pictureUrl,
            }));
        } catch (err: any) {
            console.error(`[scrapeHost:headless] Falha no fallback browser: ${err.message}`);
            return [];
        }
    }

    /**
     * Notifica o admin por e-mail quando a hash do Airbnb GraphQL expirar.
     * Envia instrução de como atualizar a variável AIRBNB_GRAPHQL_HASH no Railway.
     */
    private async notifyAdminHashExpired(expiredHash: string): Promise<void> {
        const adminEmail = process.env.ADMIN_ALERT_EMAIL;
        if (!adminEmail) {
            console.warn('⚠️ [notifyAdmin] ADMIN_ALERT_EMAIL não configurado no .env — notificação NÃO enviada.');
            return;
        }

        try {
            const subject = '🚨 Urban AI — Hash do Airbnb GraphQL Expirada';
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #e74c3c;">⚠️ Ação Necessária: Hash do Airbnb Expirada</h2>
                    <p>O sistema Urban AI detectou que a <strong>hash do GraphQL do Airbnb</strong> expirou
                    (<code>${expiredHash?.substring(0, 16)}...</code>). A importação de imóveis por host está
                    temporariamente desabilitada.</p>

                    <h3>📋 Como Corrigir (30 segundos):</h3>
                    <ol>
                        <li>Abra seu Chrome e acesse qualquer perfil de host no Airbnb
                        (ex: <a href="https://www.airbnb.com.br/users/show/1462996042612541438">este</a>)</li>
                        <li>Pressione <strong>F12</strong> → aba <strong>Network</strong></li>
                        <li>Recarregue a página (F5)</li>
                        <li>No filtro, busque por <strong>"ContextualPublicProfileQuery"</strong></li>
                        <li>Copie a string de 64 caracteres hexadecimais que aparece na URL da requisição</li>
                        <li>Acesse o Railway → Variáveis do Backend → Atualize <code>AIRBNB_GRAPHQL_HASH</code></li>
                    </ol>

                    <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
                        Este alerta é enviado apenas 1x por reinicialização do servidor.
                        Após atualizar, o sistema volta a funcionar automaticamente sem redeploy.
                    </p>
                </div>
            `;

            const result = await this.mailerService.sendHtmlEmail(
                { email: adminEmail, name: 'Admin' },
                subject,
                htmlContent,
            );

            if (!result.enviado) {
                throw new Error(result.message || `Brevo rejected email with status=${result.status}`);
            }

            console.log(`📧 [notifyAdmin] E-mail de alerta enviado para ${adminEmail}`);
        } catch (err: any) {
            console.error(`❌ [notifyAdmin] Falha ao enviar e-mail de alerta: ${err.message}`);
        }
    }

    private extractHostIdFromAirbnbHtml(html: string): string | null {
        return extractHostIdFromAirbnbHtml(html);
    }

    private async scrapeAirbnbListingHostId(roomId: string): Promise<string | null> {
        if (!/^\d{1,20}$/.test(roomId)) return null;
        const url = `https://www.airbnb.com/rooms/${roomId}`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml',
        };

        try {
            // O identificador é estritamente numérico e o host é constante.
            // lgtm[js/request-forgery]
            const response = await axios.get(url, { headers, timeout: 20000 });
            return this.extractHostIdFromAirbnbHtml(String(response.data || ''));
        } catch (_err: any) {
            console.warn('[getPropertyHostId] Falha no scrape HTML do host.');
            return null;
        }
    }

    async scrapeAirbnbListing(roomId: string): Promise<{
        roomId: string;
        title: string;
        pictureUrl: string;
        latitude: number | null;
        longitude: number | null;
        bedrooms: number;
        beds: number;
        bathrooms: number;
        rating: number;
        isNewListing: boolean;
        reviewCount: number;
        propertyType: string;
        neighborhood: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
        fullAddress: string;
        amenitiesCount: number;
        amenities: string[];
        guestCapacity: number;
        hostId: string | null;
    }> {
        if (!/^\d{1,20}$/.test(roomId)) {
            throw new BadRequestException('Identificador de anúncio Airbnb inválido.');
        }
        // Scrape em EN para extração confiável de dados estruturados
        const url = `https://www.airbnb.com/rooms/${roomId}`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml',
        };

        try {
            console.log('[scrape] Extraindo dados do Airbnb.');
            // O identificador é estritamente numérico e o host é constante.
            // lgtm[js/request-forgery]
            const response = await axios.get(url, { headers, timeout: 20000 });
            const html: string = response.data;

            // --- Meta Tags OG ---
            const ogTitle = this.extractMetaContent(html, 'og:title') || `Imóvel ${roomId}`;
            const pictureUrl = this.decodeHtmlEntities(
                this.extractMetaContent(html, 'og:image') || ''
            );

            // --- Coordenadas (JSON embeddado) ---
            const latMatch = html.match(/"lat"\s*:\s*([-\d.]+)/);
            const lngMatch = html.match(/"lng"\s*:\s*([-\d.]+)/);
            const latitude = latMatch ? parseFloat(latMatch[1]) : null;
            const longitude = lngMatch ? parseFloat(lngMatch[1]) : null;

            // --- Parse do título OG via split por "·" ---
            // EN: "Serviced apartment in São Paulo · ★4.65 · 1 bedroom · 1 bed · 1 bath"
            const segments = ogTitle.split('·').map(s => s.trim()).filter(Boolean);

            // --- Tipo e Localização (do OG title) ---
            let propertyTypeRaw = 'Unknown';
            let ogLocationHint = '';

            if (segments.length > 0) {
                const firstSeg = segments[0];
                const locationSeparator = firstSeg.toLocaleLowerCase('en-US').indexOf(' in ');
                if (locationSeparator > 0) {
                    propertyTypeRaw = firstSeg.slice(0, locationSeparator).trim();
                    ogLocationHint = firstSeg.slice(locationSeparator + 4).trim();
                } else {
                    propertyTypeRaw = firstSeg;
                    if (segments.length > 1 && !segments[1].startsWith('★') && !/^\d/.test(segments[1])) {
                        ogLocationHint = segments[1];
                    }
                }
            }

            // Traduz tipo para PT-BR
            const propertyType = this.airbnbListingMetadataService.translatePropertyType(propertyTypeRaw);

            // --- Rating ---
            const ratingSegment = segments.find(s => s.includes('★')) || '';
            const ratingNumeric = ratingSegment.match(/★([\d.]+)/);
            const rating = ratingNumeric ? parseFloat(ratingNumeric[1]) : 0;
            const isNewListing = /★\s*(?:New|Novidade|Novo)/i.test(ratingSegment);

            // --- Quartos, Camas, Banheiros ---
            const bedrooms = this.extractNumber(ogTitle, '(?:bedroom|quarto)');
            const beds = this.extractNumber(ogTitle, '(?:bed(?!room)|cama)');
            const bathrooms = this.extractNumber(ogTitle, '(?:(?:private\\s+)?bath(?:room)?|banheiro)');

            // --- Reviews ---
            const reviewMatch = html.match(/(\d+)\s+(?:reviews?|avaliações?)/i);
            const reviewCount = reviewMatch ? parseInt(reviewMatch[1], 10) : 0;

            // --- Guest capacity ---
            const guestMatch = html.match(/(\d+)\s+(?:guests?|hóspedes?)/i);
            const guestCapacity = guestMatch ? parseInt(guestMatch[1], 10) : 0;

            // --- Amenidades (lista completa + contagem) ---
            const amenitiesMatch = html.match(/(?:Show all|Mostrar\s+todas?\s+(?:as\s+)?)\s*(\d+)\s+(?:amenities|comodidades)/i);
            const amenitiesCount = amenitiesMatch ? parseInt(amenitiesMatch[1], 10) : 0;

            // Extrai lista individual de amenidades do JSON embutido
            const amenityMatches = [...html.matchAll(/"available":true,"title":"([^"]+)"/g)];
            const amenitiesRaw = amenityMatches.map(m => m[1]);
            // Remove duplicatas mantendo ordem
            const amenities = [...new Set(amenitiesRaw)];

            // --- Extrai hostId ---
            const hostId = this.extractHostIdFromAirbnbHtml(html);

            // --- 📍 Reverse Geocoding: lat/lng → endereço completo ---
            let street = '', neighborhood = '', city = '', state = '', zipCode = '', fullAddress = '';

            if (latitude && longitude) {
                const geo = await this.airbnbListingMetadataService.reverseGeocode(latitude, longitude);
                street = geo.street;
                neighborhood = geo.neighborhood;
                city = geo.city;
                state = geo.state;
                zipCode = geo.zipCode;
                fullAddress = geo.fullAddress;
            } else {
                // Fallback: usa hint do OG title
                city = ogLocationHint;
            }

            // Monta título limpo em PT-BR
            const title = `${propertyType}${neighborhood ? ' em ' + neighborhood : city ? ' em ' + city : ''}`;

            console.log('[scrape] Dados do anúncio extraídos.');

            return {
                roomId,
                title,
                pictureUrl,
                latitude,
                longitude,
                bedrooms,
                beds,
                bathrooms,
                rating,
                isNewListing,
                reviewCount,
                propertyType,
                neighborhood,
                street,
                city,
                state,
                zipCode,
                fullAddress,
                amenitiesCount,
                amenities,
                guestCapacity,
                hostId,
            };
        } catch (_err: any) {
            console.error('[scrape] Falha ao extrair dados do anúncio.');
            return {
                roomId,
                title: `Imóvel ${roomId}`,
                pictureUrl: '',
                latitude: null,
                longitude: null,
                bedrooms: 0,
                beds: 0,
                bathrooms: 0,
                rating: 0,
                isNewListing: false,
                reviewCount: 0,
                propertyType: 'Desconhecido',
                neighborhood: '',
                street: '',
                city: '',
                state: '',
                zipCode: '',
                fullAddress: '',
                amenitiesCount: 0,
                amenities: [],
                guestCapacity: 0,
                hostId: null,
            };
        }
    }

    /**
     * Scraping em lote com fila e delay de 3s entre requests.
     * Para onboarding em massa (ex: host importando 50 imóveis).
     */
    async scrapeAirbnbListingBatch(roomIds: string[]): Promise<Awaited<ReturnType<typeof this.scrapeAirbnbListing>>[]> {
        const results: Awaited<ReturnType<typeof this.scrapeAirbnbListing>>[] = [];
        console.log(`🕷️ [batch] Iniciando scraping de ${roomIds.length} imóveis (delay 3s entre cada)...`);

        for (let i = 0; i < roomIds.length; i++) {
            const roomId = roomIds[i];
            console.log(`🕷️ [batch] [${i + 1}/${roomIds.length}] Scraping room ${roomId}...`);
            const data = await this.scrapeAirbnbListing(roomId);
            results.push(data);

            // Delay de 3s entre requests (exceto no último)
            if (i < roomIds.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        console.log(`✅ [batch] Scraping finalizado: ${results.length} imóveis processados.`);
        return results;
    }

    /**
     * Cron mensal noturno: re-scraping de TODOS os imóveis ativos.
     * Espaçado ao longo de 8h (~8s por imóvel para 1000+ imóveis).
     */
    async refreshAllPropertyMetadata(): Promise<{ total: number; updated: number; errors: number }> {
        const allProperties = await this.propriedades.find({ where: { ativo: true } });
        const total = allProperties.length;
        let updated = 0;
        let errors = 0;

        // Calcula delay dinâmico: espalhar ao longo de 8h (28800s)
        const delayMs = total > 0 ? Math.max(3000, Math.floor((8 * 60 * 60 * 1000) / total)) : 3000;
        console.log(`🔄 [refresh] Re-scraping de ${total} imóveis (delay: ${(delayMs / 1000).toFixed(1)}s entre cada)...`);

        for (let i = 0; i < allProperties.length; i++) {
            const prop = allProperties[i];
            try {
                const scraped = await this.scrapeAirbnbListing(prop.id_do_anuncio);
                await this.propriedades.update(prop.id, {
                    titulo: scraped.title,
                    pictureUrl: scraped.pictureUrl,
                    quartos: scraped.bedrooms,
                    camas: scraped.beds,
                    banheiros: scraped.bathrooms,
                    hospedes: scraped.guestCapacity,
                    rating: scraped.rating,
                    propertyType: scraped.propertyType,
                    amenitiesCount: scraped.amenitiesCount,
                    neighborhood: scraped.neighborhood,
                    reviewCount: scraped.reviewCount,
                    lastScrapedAt: new Date(),
                });

                // Atualiza coordenadas no address se disponíveis
                if (scraped.latitude && scraped.longitude) {
                    const state = scraped.state ? scraped.state.slice(0, 2).toUpperCase() : undefined;
                    await this.addressRepository.update(
                        { list: { id: prop.id } },
                        {
                            latitude: scraped.latitude,
                            longitude: scraped.longitude,
                            logradouro: scraped.street || undefined,
                            bairro: scraped.neighborhood || undefined,
                            cidade: scraped.city || undefined,
                            estado: state,
                            cep: scraped.zipCode || undefined,
                        }
                    );
                }

                updated++;
                console.log(`🔄 [refresh] [${i + 1}/${total}] ✅ ${prop.id_do_anuncio} atualizado`);
            } catch (err) {
                errors++;
                console.error(`🔄 [refresh] [${i + 1}/${total}] ❌ ${prop.id_do_anuncio} falhou:`, err.message);
            }

            // Delay dinâmico
            if (i < allProperties.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        console.log(`🔄 [refresh] Concluído: ${updated}/${total} atualizados, ${errors} erros`);
        return { total, updated, errors };
    }

    /**
     * Helpers para parsing de HTML
     */
    private extractMetaContent(html: string, property: string): string | null {
        return extractMetaContent(html, property);
    }

    private decodeHtmlEntities(str: string): string {
        return decodeHtmlEntities(str);
    }

    // ===================================================================
    // 🔌 MÉTODOS PÚBLICOS REFATORADOS (usam scraping ao invés de RapidAPI)
    // ===================================================================

    /**
     * Retorna informações rápidas de um imóvel individual.
     * Usado pelo wizard de onboarding (modo individual).
     * REFATORADO: usa scraping direto ao invés de airbnb45.
     */
    async getPropertyQuickInfo(propertyId: string): Promise<{
        propertyId: string;
        title: string;
        pictureUrl: string;
        hostId: string | null;
        hostName: string | null;
        bedrooms: number;
        beds: number;
        bathrooms: number;
        guests: number;
        rating: number;
        isNewListing: boolean;
        reviewCount: number;
        propertyType: string;
        neighborhood: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
        fullAddress: string;
        latitude: number | null;
        longitude: number | null;
        amenitiesCount: number;
        amenities: string[];
    }> {
        const scraped = await this.scrapeAirbnbListing(propertyId);

        return {
            propertyId,
            title: scraped.title,
            pictureUrl: scraped.pictureUrl,
            hostId: scraped.hostId,
            hostName: null,
            bedrooms: scraped.bedrooms,
            beds: scraped.beds,
            bathrooms: scraped.bathrooms,
            guests: scraped.guestCapacity,
            rating: scraped.rating,
            isNewListing: scraped.isNewListing,
            reviewCount: scraped.reviewCount,
            propertyType: scraped.propertyType,
            neighborhood: scraped.neighborhood,
            street: scraped.street,
            city: scraped.city,
            state: scraped.state,
            zipCode: scraped.zipCode,
            fullAddress: scraped.fullAddress,
            latitude: scraped.latitude,
            longitude: scraped.longitude,
            amenitiesCount: scraped.amenitiesCount,
            amenities: scraped.amenities,
        };
    }

    /**
     * Resolve o hostId a partir de um anúncio. Primeiro tenta o HTML público
     * e usa o navegador headless como fallback para páginas renderizadas.
     */
    async getPropertyHostId(propertyId: string): Promise<{ hostId: any | null, hostName: any | null }> {
        console.log('[getPropertyHostId] Buscando host do Airbnb.');
        const htmlHostId = await this.scrapeAirbnbListingHostId(propertyId);
        if (htmlHostId) return { hostId: htmlHostId, hostName: null };

        const renderedHost = await this.airbnbService.resolveListingHostId(propertyId);
        return {
            hostId: renderedHost.hostId,
            hostName: renderedHost.hostName,
        };
    }
    async getAccommodationAndFee(
        propertyId: string,
        checkinDate: string,
        checkoutDate: string
    ): Promise<any> {
        const useAirbnbSearchService = process.env.AIRBNB_PRICE_PROVIDER !== 'legacy-propriedades';
        if (useAirbnbSearchService) {
            try {
                const quote = await this.airbnbService.getPriceForDateWindow(propertyId, checkinDate, checkoutDate);
                const total = Number(quote.price.data.accommodationCost);
                const nights = Number(quote.nights ?? 1);
                const daily = Number((total / Math.max(1, nights)).toFixed(2));

                return {
                    accommodation: {
                        brl: total,
                        formatted: quote.price.data.accommodationCostFormatted,
                    },
                    airbnbGuestFee: null,
                    total: {
                        brl: total,
                        formatted: quote.price.data.accommodationCostFormatted,
                    },
                    dailyPrice: daily,
                    nights,
                    checkIn: quote.checkIn,
                    checkOut: quote.checkOut,
                    source: quote.source,
                };
            } catch (error: any) {
                this.logger.warn(
                    `Falha ao buscar preço airbnb-search para room ${propertyId}: ${error?.message || error}`,
                );
                throw new HttpException(
                    'Não foi possível consultar o preço agora. Tente novamente em alguns minutos.',
                    HttpStatus.BAD_REQUEST,
                );
            }
        }

        const apiUrl = 'https://airbnb45.p.rapidapi.com/api/v1/getCheckoutPrefetch';
        const apiKey = process.env.RAPIDAPI_KEY as string;
        const apiHost = 'airbnb45.p.rapidapi.com';

        try {
            const { data } = await axios.get<AirbnbQuoteResponse>(apiUrl, {
                params: {
                    propertyId,
                    checkinDate,
                    checkoutDate,
                    numberOfAdults: 1,
                    numberOfChildren: 0,
                    numberOfPets: 0,
                    numberOfInfants: 0,
                },
                headers: {
                    'x-rapidapi-host': apiHost,
                    'x-rapidapi-key': apiKey,
                },
            });
            this.logger.debug(`Quote response received for property=${propertyId}`);
            // Se houver mensagem de erro no metadata
            const errorMessage = data?.data?.metadata?.errorData?.errorMessage?.errorMessage;
            if (errorMessage) {
                throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
            }

            const priceItems = data?.data?.priceBreakdown?.priceItems || [];

            const accommodationItem = priceItems.find(item => item.type === 'ACCOMMODATION');
            const guestFeeItem = priceItems.find(item => item.type === 'AIRBNB_GUEST_FEE');

            if (!accommodationItem || !guestFeeItem) {
                throw new HttpException('Não encontramos preço para essas datas. Tente outro período.', HttpStatus.NOT_FOUND);
            }

            // Converte de string para float
            const accommodation = parseFloat(accommodationItem.total.amountFormatted.replace('$', ''));
            const guestFee = parseFloat(guestFeeItem.total.amountFormatted.replace('$', ''));

            const total = accommodation + guestFee;

            // Retorna formatado
            return {
                accommodation: {
                    usd: accommodation,
                    formatted: accommodationItem.total.amountFormatted
                },
                airbnbGuestFee: {
                    usd: guestFee,
                    formatted: guestFeeItem.total.amountFormatted
                },
                total: {
                    usd: total,
                    formatted: `$${total.toFixed(2)}`
                }
            };

        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.warn(
                `Falha ao buscar preço do Airbnb para room ${propertyId}: ${error?.message || error}`,
            );
            throw new HttpException(
                'Não foi possível consultar o preço agora. Tente novamente em alguns minutos.',
                HttpStatus.BAD_REQUEST,
            );
        }
    }


    /**
     * REFATORADO: usa scraping direto ao invés de airbnb45.
     */
    async getPropertyDetails(propertyId: string): Promise<PropertyResponseDto> {
        const scraped = await this.scrapeAirbnbListing(propertyId);
        return {
            bedrooms: scraped.bedrooms,
            beds: scraped.beds,
            guestMaximum: scraped.guestCapacity,
        };
    }

    private extractNumber(text: string, keyword: string): number {
        return extractNumber(text, keyword);
    }

    private async findOwnedPropertyByExternalId(id_do_anuncio: string, userId: string): Promise<List> {
        const propriedade = await this.propriedades.findOne({
            where: { id_do_anuncio, user: { id: userId } },
        });

        if (!propriedade) {
            throw new NotFoundException('Não encontramos esse imóvel na sua conta.');
        }

        return propriedade;
    }

    async updateByIdDoAnuncio(id_do_anuncio: string, userId: string, updateData: Partial<List>) {
        const propriedade = await this.findOwnedPropertyByExternalId(id_do_anuncio, userId);

        // Atualiza os campos com os dados recebidos
        Object.assign(propriedade, updateData);

        // Salva a atualização no banco
        return await this.propriedades.save(propriedade);
    }
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
    async getRoomPrice({
        roomId,
        checkIn,
        checkOut,
        userId,
    }: {
        roomId: string;
        checkIn: string;
        checkOut: string;
        userId: string;
    }) {
        await this.findOwnedPropertyByExternalId(roomId, userId);
        const useAirbnbSearchService = process.env.AIRBNB_PRICE_PROVIDER !== 'legacy-room-price';
        if (useAirbnbSearchService) {
            const quote = await this.airbnbService.getPriceForDateWindow(roomId, checkIn, checkOut);
            const total = Number(quote.price.data.accommodationCost);
            const numberOfNights = Number(quote.nights ?? 1);
            const dailyPrice = Number((total / Math.max(1, numberOfNights)).toFixed(2));

            const propriedadeAtualizado = await this.updateByIdDoAnuncio(roomId, userId, {
                raw: total,
                priceText: quote.price.data.accommodationCostFormatted,
                currency: 'BRL',
                checkIn: quote.checkIn ?? checkIn,
                checkOut: quote.checkOut ?? checkOut,
                dailyPrice,
            });

            return {
                property: propriedadeAtualizado,
                price: {
                    raw: total,
                    priceText: quote.price.data.accommodationCostFormatted,
                    currency: 'BRL',
                    checkIn: quote.checkIn ?? checkIn,
                    checkOut: quote.checkOut ?? checkOut,
                    dailyPrice,
                    numberOfNights,
                    source: quote.source,
                },
            };
        }

        const baseUrl = process.env.AIRBNB_PRICE_SCRAPER_URL?.trim();
        if (!baseUrl) {
            throw new HttpException(
                'AIRBNB_PRICE_SCRAPER_URL não configurada',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        try {
            const requestUrl = new URL(baseUrl);
            requestUrl.searchParams.set('roomId', roomId);
            requestUrl.searchParams.set('checkIn', checkIn);
            requestUrl.searchParams.set('checkOut', checkOut);
            const response = await fetch(requestUrl.toString(), { method: 'GET' });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();

            // Calcula diária com base no período
            const checkInDate = new Date(data.price.checkIn);
            const checkOutDate = new Date(data.price.checkOut);
            const numberOfNights = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

            const dailyPrice = data.price.raw / numberOfNights;

            await this.updateByIdDoAnuncio(roomId, userId, {
                raw: data?.price?.raw ?? 0,
                priceText: data?.price?.priceText ?? "",
                currency: data?.price?.currency ?? "",
                checkIn: data?.price?.checkIn ?? "",
                checkOut: data?.price?.checkOut ?? "",
                dailyPrice: dailyPrice ?? 0,

            });


            // Retorna tudo original + diária
            return {
                ...data,
                price: {
                    ...data.price,
                    dailyPrice,
                    numberOfNights
                }
            };

        } catch (error) {
            console.error('Erro ao buscar preço por propriedade:', error);
            throw error;
        }
    }

    /**
     * REFATORADO: usa scraping direto ao invés de airbnb45.
     */
    async getPropertyCoordinates(propertyId: string): Promise<PropertyCoordinatesDto | null> {
        const scraped = await this.scrapeAirbnbListing(propertyId);
        if (scraped.latitude && scraped.longitude) {
            return {
                latitude: scraped.latitude,
                longitude: scraped.longitude,
            };
        }
        return null;
    }
    // Service
    async getRoomBasicInfo(roomId: string, userId: string) {
        await this.findOwnedPropertyByExternalId(roomId, userId);
        const baseUrl = process.env.AIRBNB_ROOM_INFO_URL?.trim();
        if (!baseUrl) {
            throw new HttpException(
                'AIRBNB_ROOM_INFO_URL não configurada',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        try {
            // Faz a requisição com axios usando params para query string
            const { data } = await axios.get(baseUrl, {
                params: { roomId }
            });

            // Atualiza o banco com todos os campos da API
            await this.updateByIdDoAnuncio(roomId, userId, {
                titulo: data?.info?.titulo ?? "",
                hospedes: data?.info?.hospedes ?? 0,
                quartos: data?.info?.quartos ?? 0,
                camas: data?.info?.camas ?? 0,
                banheiros: data?.info?.banheiros ?? 0,
                status: data?.info?.status ?? "desconhecido"
            });

            // Retorna o objeto original da API
            return data;

        } catch (error: any) {
            console.error('Erro ao buscar informações da propriedade:', error.response?.data || error.message);
            throw error;
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
                        category: c.similarity_score >= 0.8 ? 2 : (c.similarity_score >= 0.5 ? 1 : 0)
                    }));
                    this.aiEngine.initialize(treinamentoLocal);

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

                    const prediCaaaoIA = await this.aiEngine.suggestPrice(minhaPropParaIA, eventoParaIA, Number(minhaPropriedadePricePerDay));

                    if(prediCaaaoIA && prediCaaaoIA.suggestedPrice) {
                        precoFinalSugerido = Math.max(prediCaaaoIA.suggestedPrice, result.precoSugerido); // Mantém o melhor dos dois mundos pro cliente (maior lucro)
                        percentualFinal = Number((((precoFinalSugerido - result.seuPrecoAtual) / result.seuPrecoAtual) * 100).toFixed(1));
                        recomendacaoFinal = (percentualFinal > 0) ? "Aumento de Receita Sugerido (IA)" : "Manutenção de Fator de Ocupação (IA)";
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
