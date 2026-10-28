import { forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { HTTP_TIMEOUT_MS, fetchWithTimeout } from '../common/http-timeouts';
import { TtlCache } from '../common/ttl-cache';
import { Repository } from 'typeorm';
import { AirbnbQuoteResponse } from './types/types';
import { List } from 'src/entities/list.entity';
import { AirbnbService } from 'src/airbnb/airbnb.service';

/**
 * PropertyListingQuoteService — cotações Airbnb de um anúncio (diária,
 * taxas, informações básicas) e persistência no imóvel do próprio tenant.
 */
@Injectable()
export class PropertyListingQuoteService {
    // Mantém o contexto de log original para não quebrar buscas/alertas existentes.
    private readonly logger = new Logger('PropriedadeService');

    /** Cotações de preço (dado público do anúncio, não do usuário): cache curto contém o custo upstream. */
    private readonly quoteCache = new TtlCache<any>(5 * 60_000);

    constructor(
        @InjectRepository(List)
        private readonly propriedades: Repository<List>,
        @Inject(forwardRef(() => AirbnbService))
        private readonly airbnbService: AirbnbService,
    ) {}

    getAccommodationAndFee(
        propertyId: string,
        checkinDate: string,
        checkoutDate: string
    ): Promise<any> {
        return this.quoteCache.getOrLoad(
            `fee|${propertyId}|${checkinDate}|${checkoutDate}`,
            () => this.fetchAccommodationAndFee(propertyId, checkinDate, checkoutDate),
        );
    }

    private async fetchAccommodationAndFee(
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
                timeout: HTTP_TIMEOUT_MS.default,
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
            const quote = await this.quoteCache.getOrLoad(
                `room|${roomId}|${checkIn}|${checkOut}`,
                () => this.airbnbService.getPriceForDateWindow(roomId, checkIn, checkOut),
            );
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
            const response = await fetchWithTimeout(requestUrl.toString(), { method: 'GET' }, HTTP_TIMEOUT_MS.default);

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
                params: { roomId },
                timeout: HTTP_TIMEOUT_MS.default,
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
}
