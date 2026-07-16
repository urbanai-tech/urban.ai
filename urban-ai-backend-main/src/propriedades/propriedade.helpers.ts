import { HttpException, HttpStatus } from '@nestjs/common';
import { Address } from 'src/entities/addresses.entity';
import { List } from 'src/entities/list.entity';
import { OccupancyHistory } from 'src/entities/occupancy-history.entity';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Event as EventEntity } from 'src/entities/events.entity';
import { FirstAvailablePriceResult } from 'src/airbnb/types';
import { hasUsableBasePrice, resolveUsableBaseDailyPrice } from 'src/pricing/base-price.util';

// ===================================================================
// Tipos públicos de resposta (extraídos de PropriedadeService)
// Funções puras/sem estado deste módulo dependem destes tipos.
// ===================================================================

export type PublicListResponse = {
    id: string;
    titulo: string;
    id_do_anuncio: string;
    internalNickname: string | null;
    internalCode: string | null;
    pictureUrl: string | null;
    ativo: boolean;
    userId: string | null;
    priceText: string | null;
    raw: number | null;
    currency: string | null;
    checkIn: string | null;
    checkOut: string | null;
    status: string | null;
    dailyPrice: number | null;
    manualDailyPrice: number | null;
    averageMonthlyRevenue: number | null;
    pricingInputSource: string | null;
    pricingInputsUpdatedAt: Date | null;
    hospedes: number | null;
    quartos: number | null;
    camas: number | null;
    banheiros: number | null;
    rating: number | null;
    propertyType: string | null;
    amenitiesCount: number | null;
    neighborhood: string | null;
    reviewCount: number | null;
    lastScrapedAt: Date | null;
};

export type PublicAddressResponse = {
    id: string;
    cep: string;
    numero: string;
    logradouro: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    latitude: number | null;
    longitude: number | null;
    ativo: boolean;
    created_at: Date;
    updated_at: Date;
    analisado: string;
    idAlertAirb: string;
    userId: string | null;
    list: PublicListResponse | null;
};

export type PublicPropertySetupStatus = {
    state: 'preparing' | 'ready' | 'error';
    currentStep: 'map' | 'events' | 'suggestions' | 'ready' | 'attention';
    publicLabel: string;
    publicDescription: string;
    steps: Array<{
        id: 'saved' | 'map' | 'events' | 'suggestions';
        label: string;
        status: 'complete' | 'active' | 'pending' | 'error';
    }>;
};

export type PricingNotificationHighlight = {
    eventName?: string | null;
    eventDate?: string | null;
    eventLocation?: string | null;
    distanceKm?: number | null;
    relevance?: number | null;
    expectedAttendance?: number | null;
    currentPrice?: number | null;
    suggestedPrice?: number | null;
    liftPercent?: number | null;
    recommendation?: string | null;
    reason?: string | null;
};

// ===================================================================
// Primitivos numéricos / de string
// ===================================================================

export function nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function isSameNumber(left: unknown, right: unknown, tolerance = 0.01): boolean {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
        return leftNumber === rightNumber;
    }
    return Math.abs(leftNumber - rightNumber) <= tolerance;
}

export function sameMoney(a: number | null, b: number | null): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

export function dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
}

export function extractNumber(text: string, keyword: string): number {
    if (!text) return 0;
    const regex = new RegExp(`(\\d+)\\s+${keyword}`, 'i');
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
}

export function extractMetaContent(html: string, property: string): string | null {
    // Tenta ambas as ordens de atributos
    const regex1 = new RegExp(`property="${property}"\\s+content="([^"]+)"`, 'i');
    const regex2 = new RegExp(`content="([^"]+)"\\s+property="${property}"`, 'i');
    const match = html.match(regex1) || html.match(regex2);
    return match ? match[1] : null;
}

export function decodeHtmlEntities(str: string): string {
    return str.replace(/&(?:amp|lt|gt|quot);/g, (entity) => {
        switch (entity) {
            case '&amp;': return '&';
            case '&lt;': return '<';
            case '&gt;': return '>';
            case '&quot;': return '"';
            default: return entity;
        }
    });
}

export function extractHostIdFromAirbnbHtml(html: string): string | null {
    const patterns = [
        /"hostId"\s*:\s*"(\d+)"/,
        /"hostId"\s*:\s*(\d+)/,
        /\/users\/(?:show|profile)\/(\d+)/,
        /ContextualUser:(\d+)/,
        /Host:(\d+)/,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return String(match[1]);
    }

    return null;
}

export function compactText(value?: string | null): string | null {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

export function formatMoney(value: number): string {
    if (!Number.isFinite(value)) return 'R$ 0';
    return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
}

export function formatEventDateForEmail(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: 'short',
    }).format(date);
}

export function formatSuggestionCount(count: number, qualifier?: string): string {
    const base = `${count} ${count === 1 ? 'sugestão' : 'sugestões'} de preço`;
    return qualifier ? `${base} ${count === 1 ? qualifier : `${qualifier}s`}` : base;
}

export function normalizeRole(value: unknown): string {
    const role = String(value ?? 'host').trim().toLowerCase();
    return role || 'host';
}

// ===================================================================
// Validadores de entrada (lançam HttpException)
// ===================================================================

export function normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) {
        throw new HttpException(`${field} deve ter no máximo ${maxLength} caracteres`, HttpStatus.BAD_REQUEST);
    }
    return normalized;
}

export function normalizeOptionalMoney(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new HttpException(`${field} inválido`, HttpStatus.BAD_REQUEST);
    }
    return parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

export function normalizeOptionalInteger(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new HttpException(`${field} inválido`, HttpStatus.BAD_REQUEST);
    }
    return Math.floor(parsed);
}

export function normalizeDateOnly(value: unknown, field: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        throw new HttpException(`${field} deve estar no formato YYYY-MM-DD`, HttpStatus.BAD_REQUEST);
    }
    return normalized;
}

export function normalizeOccupancyStatus(value: unknown): 'booked' | 'available' | 'blocked' | 'unknown' {
    const status = String(value ?? 'unknown').trim();
    if (status === 'booked' || status === 'available' || status === 'blocked' || status === 'unknown') {
        return status;
    }
    throw new HttpException('status de ocupação inválido', HttpStatus.BAD_REQUEST);
}

// ===================================================================
// Formatação / mapeamento a partir de entidades (puros)
// ===================================================================

export function hasUsableCoordinates(address: Address): boolean {
    const latitude = Number(address?.latitude);
    const longitude = Number(address?.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
}

export function formatLocationLabel(address: Address): string | null {
    if (address.cidade && address.estado) return `${address.cidade}, ${address.estado}`;
    return address.cidade ?? address.estado ?? null;
}

export function formatAddressLine(address: Address): string | null {
    const street = [address.logradouro, address.numero].filter(Boolean).join(', ');
    return [street || null, address.bairro ?? null, formatLocationLabel(address), address.cep ? `CEP ${address.cep}` : null]
        .filter(Boolean)
        .join(' - ') || null;
}

export function formatAddressForEmail(address: Address | null | undefined): string | undefined {
    if (!address) return undefined;
    const parts = [
        address.logradouro && address.numero ? `${address.logradouro}, ${address.numero}` : address.logradouro || address.numero,
        address.bairro,
        address.cidade && address.estado ? `${address.cidade} - ${address.estado}` : address.cidade || address.estado,
        address.cep ? `CEP ${address.cep}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
}

export function toPublicOccupancyRecord(record: OccupancyHistory) {
    return {
        id: record.id,
        date: record.date,
        status: record.status,
        revenue: record.revenueCents == null ? null : Number((record.revenueCents / 100).toFixed(2)),
        listedPrice: record.listedPriceCents == null ? null : Number((record.listedPriceCents / 100).toFixed(2)),
        currency: record.currency,
        origin: record.origin,
        nightsBooked: record.nightsBooked ?? null,
        trainingReady: record.trainingReady,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

export function toPublicList(list: List): PublicListResponse {
    return {
        id: list.id,
        titulo: list.titulo,
        id_do_anuncio: list.id_do_anuncio,
        internalNickname: list.internalNickname ?? null,
        internalCode: list.internalCode ?? null,
        pictureUrl: list.pictureUrl ?? null,
        ativo: list.ativo,
        userId: list.user?.id ?? null,
        priceText: list.priceText ?? null,
        raw: nullableNumber(list.raw),
        currency: list.currency ?? null,
        checkIn: list.checkIn ?? null,
        checkOut: list.checkOut ?? null,
        status: list.status ?? null,
        dailyPrice: nullableNumber(list.dailyPrice),
        manualDailyPrice: nullableNumber(list.manualDailyPrice),
        averageMonthlyRevenue: nullableNumber(list.averageMonthlyRevenue),
        pricingInputSource: list.pricingInputSource ?? null,
        pricingInputsUpdatedAt: list.pricingInputsUpdatedAt ?? null,
        hospedes: list.hospedes ?? null,
        quartos: list.quartos ?? null,
        camas: list.camas ?? null,
        banheiros: list.banheiros ?? null,
        rating: nullableNumber(list.rating),
        propertyType: list.propertyType ?? null,
        amenitiesCount: list.amenitiesCount ?? null,
        neighborhood: list.neighborhood ?? null,
        reviewCount: list.reviewCount ?? null,
        lastScrapedAt: list.lastScrapedAt ?? null,
    };
}

export function toPublicAddress(address: Address): PublicAddressResponse {
    return {
        id: address.id,
        cep: address.cep,
        numero: address.numero,
        logradouro: address.logradouro ?? null,
        bairro: address.bairro ?? null,
        cidade: address.cidade ?? null,
        estado: address.estado ?? null,
        latitude: nullableNumber(address.latitude),
        longitude: nullableNumber(address.longitude),
        ativo: address.ativo,
        created_at: address.created_at,
        updated_at: address.updated_at,
        analisado: address.analisado,
        idAlertAirb: address.idAlertAirb,
        userId: address.user?.id ?? address.list?.user?.id ?? null,
        list: address.list ? toPublicList(address.list) : null,
    };
}

export function buildPublicPropertySetupStatus(address: Address): PublicPropertySetupStatus {
    const hasCoordinates = hasUsableCoordinates(address);
    const hasBasePrice = hasUsableBasePrice(address?.list);
    const rawStatus = String(address?.analisado ?? '').toLowerCase();
    const isCompleted = rawStatus === 'completed';
    const isError = rawStatus === 'error';

    if (isError) {
        return {
            state: 'error',
            currentStep: 'attention',
            publicLabel: 'Precisa de atenção',
            publicDescription: 'Não conseguimos terminar a preparação deste imóvel. Revise endereço e tente novamente.',
            steps: [
                { id: 'saved', label: 'Imóvel adicionado', status: 'complete' },
                { id: 'map', label: 'Preparar mapa', status: hasCoordinates ? 'complete' : 'error' },
                { id: 'events', label: 'Procurar eventos perto', status: 'pending' },
                { id: 'suggestions', label: 'Preparar sugestões', status: 'pending' },
            ],
        };
    }

    if (isCompleted && hasCoordinates) {
        if (!hasBasePrice) {
            return {
                state: 'preparing',
                currentStep: 'attention',
                publicLabel: 'Diária base pendente',
                publicDescription: 'Informe a diária base para liberar sugestões de preço neste imóvel.',
                steps: [
                    { id: 'saved', label: 'Imóvel adicionado', status: 'complete' },
                    { id: 'map', label: 'Mapa pronto', status: 'complete' },
                    { id: 'events', label: 'Eventos verificados', status: 'complete' },
                    { id: 'suggestions', label: 'Preparar sugestões', status: 'pending' },
                ],
            };
        }

        return {
            state: 'ready',
            currentStep: 'ready',
            publicLabel: 'Pronto para sugestões',
            publicDescription: 'Este imóvel já pode mostrar mapa, eventos por perto e sugestões de preço.',
            steps: [
                { id: 'saved', label: 'Imóvel adicionado', status: 'complete' },
                { id: 'map', label: 'Mapa pronto', status: 'complete' },
                { id: 'events', label: 'Eventos verificados', status: 'complete' },
                { id: 'suggestions', label: 'Sugestões prontas', status: 'complete' },
            ],
        };
    }

    if (!hasCoordinates) {
        return {
            state: 'preparing',
            currentStep: 'map',
            publicLabel: 'Preparando mapa',
            publicDescription: 'Estamos encontrando a localização para buscar eventos perto deste imóvel.',
            steps: [
                { id: 'saved', label: 'Imóvel adicionado', status: 'complete' },
                { id: 'map', label: 'Preparar mapa', status: 'active' },
                { id: 'events', label: 'Procurar eventos perto', status: 'pending' },
                { id: 'suggestions', label: 'Preparar sugestões', status: 'pending' },
            ],
        };
    }

    return {
        state: 'preparing',
        currentStep: 'events',
        publicLabel: 'Procurando eventos perto',
        publicDescription: 'Estamos olhando os eventos da região para preparar sugestões de preço.',
        steps: [
            { id: 'saved', label: 'Imóvel adicionado', status: 'complete' },
            { id: 'map', label: 'Mapa pronto', status: 'complete' },
            { id: 'events', label: 'Procurar eventos perto', status: 'active' },
            { id: 'suggestions', label: 'Preparar sugestões', status: 'pending' },
        ],
    };
}

// ===================================================================
// Análises / eventos (puros)
// ===================================================================

export function getUniqueAnalysesByEvent(analyses: AnaliseEnderecoEvento[]): AnaliseEnderecoEvento[] {
    const byEvent = new Map<string, AnaliseEnderecoEvento>();
    for (const analysis of analyses) {
        const eventId = analysis?.evento?.id;
        if (!eventId || byEvent.has(eventId)) continue;
        byEvent.set(eventId, analysis);
    }
    return Array.from(byEvent.values());
}

export function getPricingEventQualityFlags(evento: EventEntity | null | undefined, now = new Date()): string[] {
    const flags: string[] = [];
    if (!evento) return ['missing_event'];
    if (evento.ativo === false) flags.push('inactive');
    if (evento.outOfScope === true) flags.push('out_of_scope');
    if (evento.pendingGeocode === true) flags.push('pending_geocode');
    if (!evento.dataInicio || new Date(evento.dataInicio) < now) flags.push('past_or_missing_date');
    if (!evento.latitude || !evento.longitude) flags.push('missing_coordinates');

    const sourceText = `${evento.source ?? ''} ${evento.categoria ?? ''} ${evento.venueType ?? ''} ${evento.nome ?? ''}`.toLowerCase();
    if (sourceText.includes('online') || sourceText.includes('virtual') || sourceText.includes('webinar')) {
        flags.push('online_event');
    }

    const relevance = Number(evento.relevancia);
    const radius = Number(evento.raioImpactoKm);
    if (Number.isFinite(relevance) && relevance <= 0 && Number.isFinite(radius) && radius <= 0) {
        flags.push('zero_impact');
    }

    return flags;
}

export function isSamePricingAnalysis(
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
): boolean {
    return (
        isSameNumber(existing.distanciaSuaPropriedade, next.distanciaSuaPropriedade, 0.001) &&
        isSameNumber(existing.distanciaPropriedadeReferencia, next.distanciaPropriedadeReferencia, 0.001) &&
        isSameNumber(existing.precoSugerido, next.precoSugerido) &&
        isSameNumber(existing.seuPrecoAtual, next.seuPrecoAtual) &&
        isSameNumber(existing.diferencaPercentual, next.diferencaPercentual) &&
        (existing.recomendacao ?? '') === (next.recomendacao ?? '') &&
        (existing.motivo_ia ?? '') === (next.motivo_ia ?? '')
    );
}

// ===================================================================
// Notificações de pricing (puros)
// ===================================================================

export function buildPricingNotificationDescription(listTitle: string | undefined, created: number, updated: number): string {
    const propertyLabel = listTitle || 'imóvel';
    if (created > 0 && updated > 0) {
        return `Neste lote de monitoramento, geramos ${formatSuggestionCount(created, 'nova')} e atualizamos ${formatSuggestionCount(updated)} para ${propertyLabel}.`;
    }
    if (created > 0) {
        return `Neste lote de monitoramento, geramos ${formatSuggestionCount(created)} para ${propertyLabel}.`;
    }
    return `Neste lote de monitoramento, atualizamos ${formatSuggestionCount(updated)} para ${propertyLabel}.`;
}

export function selectPrimaryPricingHighlight(highlights: PricingNotificationHighlight[]) {
    return [...highlights].sort((left, right) => {
        const relevanceDiff = Number(right.relevance ?? 0) - Number(left.relevance ?? 0);
        if (relevanceDiff !== 0) return relevanceDiff;
        return Math.abs(Number(right.liftPercent ?? 0)) - Math.abs(Number(left.liftPercent ?? 0));
    })[0] || null;
}

export function buildPricingDigestReasons(
    highlights: PricingNotificationHighlight[],
    created: number,
    updated: number,
): string[] {
    const reasons: string[] = [];
    const primary = selectPrimaryPricingHighlight(highlights);

    if (primary?.eventName) {
        const date = primary.eventDate ? ` em ${primary.eventDate}` : '';
        const location = primary.eventLocation ? ` (${primary.eventLocation})` : '';
        const relevance = Number.isFinite(Number(primary.relevance))
            ? `, relevância ${Math.round(Number(primary.relevance))}/100`
            : '';
        reasons.push(`Principal sinal: ${primary.eventName}${date}${location}${relevance}.`);
    }

    if (primary && Number.isFinite(Number(primary.distanceKm))) {
        const attendance = Number.isFinite(Number(primary.expectedAttendance))
            ? ` e público estimado de ${Math.round(Number(primary.expectedAttendance)).toLocaleString('pt-BR')} pessoas`
            : '';
        reasons.push(`O evento mais forte está a ${Number(primary.distanceKm).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km do imóvel${attendance}.`);
    }

    if (
        primary &&
        Number.isFinite(Number(primary.currentPrice)) &&
        Number.isFinite(Number(primary.suggestedPrice))
    ) {
        const lift = Number.isFinite(Number(primary.liftPercent))
            ? ` (${Number(primary.liftPercent) > 0 ? '+' : ''}${Number(primary.liftPercent).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`
            : '';
        reasons.push(`Preço atual ${formatMoney(Number(primary.currentPrice))}; sugestão ${formatMoney(Number(primary.suggestedPrice))}${lift}.`);
    }

    const otherEvents = highlights
        .filter((highlight) => highlight.eventName && highlight.eventName !== primary?.eventName)
        .slice(0, 2)
        .map((highlight) => highlight.eventName);
    if (otherEvents.length) {
        reasons.push(`Outros sinais na mesma janela: ${otherEvents.join(', ')}.`);
    }

    const recommendation = compactText(primary?.recommendation || primary?.reason);
    if (recommendation) {
        reasons.push(recommendation);
    }

    const roundParts = [
        created > 0 ? formatSuggestionCount(created, 'nova') : null,
        updated > 0 ? `${formatSuggestionCount(updated)} atualizadas` : null,
    ].filter(Boolean);
    if (roundParts.length) {
        reasons.push(`${roundParts.join(' e ')} nesta rodada.`);
    }

    return reasons.slice(0, 4);
}

// ===================================================================
// Quotes / comps de pricing (puros)
// ===================================================================

export function resolveStoredDailyPrice(list: List): number | null {
    return resolveUsableBaseDailyPrice(list);
}

export function buildManualPriceQuote(
    dailyPrice: number,
    details: { bedrooms?: number; beds?: number; guestMaximum?: number },
): FirstAvailablePriceResult {
    return {
        price: {
            status: true,
            message: 'Preço base manual informado pelo anfitrião',
            timestamp: Date.now(),
            data: {
                accommodationCost: Number(dailyPrice.toFixed(2)),
                accommodationCostFormatted: `R$${dailyPrice.toFixed(2)}`,
                accommodationCostTitle: '1 night',
                details: [],
            },
        },
        propertyDetails: {
            bedrooms: Number(details?.bedrooms ?? 1),
            beds: Number(details?.beds ?? 1),
            guestMaximum: Number(details?.guestMaximum ?? 1),
        },
        nights: 1,
        source: 'manual',
    };
}

export function toDirectComp(address: Address, dailyPrice: number, details: any, distanceKm: number): any {
    const list = address.list as List;
    return {
        listingID: list?.id_do_anuncio,
        bathrooms: Number(details?.bathrooms ?? list?.banheiros ?? 1),
        bedrooms: String(Number(details?.bedrooms ?? list?.quartos ?? 1)),
        accommodates: Number(details?.guestMaximum ?? list?.hospedes ?? 1),
        name: list?.titulo ?? `Listing ${list?.id_do_anuncio}`,
        thumbnail_url: list?.pictureUrl ?? '',
        host_id: '',
        host_name: '',
        room_type: 'entire_home',
        latitude: Number(address.latitude),
        longitude: Number(address.longitude),
        minimum_nights: 1,
        visible_review_count: Number(list?.reviewCount ?? 0),
        reveiw_scores_rating: Number(list?.rating ?? 0) || null,
        amenities: {},
        cleaning_fee: null,
        annual_revenue_ltm: 0,
        revenue_potential: 0,
        avg_occupancy_rate_ltm: 0,
        avg_booked_daily_rate_ltm: Number(dailyPrice),
        active_days_count_ltm: 0,
        no_of_bookings_ltm: null,
        booked_daily_rate_ltm_monthly: {},
        revenue_ltm_monthly: {},
        occupancy_rate_ltm_monthly: {},
        no_of_bookings_ltm_monthly: {},
        is_selected: 0,
        last_seen: new Date(),
        thumbnail_url_extended: null,
        rank: 1,
        similarity_score_meta: {},
        similarity_score: Number(Math.max(0.5, 1 - distanceKm / 10).toFixed(2)),
        distance: distanceKm,
    };
}
