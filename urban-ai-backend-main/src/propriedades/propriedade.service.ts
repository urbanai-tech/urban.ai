import { forwardRef, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Address } from 'src/entities/addresses.entity';
import { Between, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { AirbnbQuoteResponse } from './types/types';
import { List } from 'src/entities/list.entity';
import { ApiProperty } from '@nestjs/swagger';
import { APITypes, Convert } from './types/nearProperties';
import { PricingCalculateService } from './pricing-calculate.service';
import { calculateDistance, getDiaria } from 'src/util';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { Event as EventEntity } from 'src/entities/events.entity';
import { AirbnbService } from 'src/airbnb/airbnb.service';

import * as jsonData from './mock_para_teste/read.json';
import pLimit from 'p-limit';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { User } from 'src/entities/user.entity';
import { EmailService } from 'src/email/email.service';
import { PropertyCoordinatesDto } from './tdo/property-coordinates.dto';
import { FirstAvailablePriceResult } from 'src/airbnb/types';
import dayjs from 'dayjs';
import { addDays, startOfDay, startOfMonth } from 'date-fns';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';

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
        @Inject(forwardRef(() => AirbnbService))
        private readonly airbnbService: AirbnbService,
        private readonly emailService: EmailService,
    ) { }

    async findByUserId(
        userId: string,
        page = 1,
        limit = 10
    ): Promise<{ data: Address[]; total: number; page: number; limit: number }> {
        const [data, total] = await this.addressRepository.findAndCount({
            where: { user: { id: userId } },
            relations: ['list'],
            skip: (page - 1) * limit,
            take: limit,
            order: { created_at: 'DESC' },
        });

        return { data, total, page, limit };
    }

    async findAddressById(id: string): Promise<Address> {
        return this.addressRepository.findOne({
            where: { id },
            relations: ["list", "user"],
        });
    }

    async deleteAddressAndList(addressId: string): Promise<void> {
        // 1. Buscar o endereço pelo ID (junto com o list relacionado)
        const address = await this.addressRepository.findOne({
            where: { id: addressId },
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
    ): Promise<{ id: string; propertyName: string; userId: string, latitude: number, longitude: number }[]> {
        // Busca específica pelo userId fornecido
        const addresses = await this.addressRepository.find({
            where: { user: { id: userId } },
            relations: ['list'],
            select: ['id', 'analisado', 'latitude', 'longitude']
        });

        return addresses.map(address => ({
            latitude: address?.latitude,
            longitude: address?.longitude,
            id: address.id,
            propertyName: address.list?.titulo || `Propriedade sem nome (${address.id.substring(0, 4)})`,
            image_url: address.list?.pictureUrl,
            userId: userId,
            analisado: address?.analisado
        }));

    }
    async getPropertyHostId(propertyId: string): Promise<{ hostId: any | null, hostName: any | null }> {
        const apiUrl = 'https://airbnb45.p.rapidapi.com/api/v1/getPropertyDetails';
        const apiKey = process.env.RAPIDAPI_KEY as string;
        const apiHost = 'airbnb45.p.rapidapi.com';
        try {
            const { data } = await axios.get<any>(apiUrl, {
                params: { propertyId },
                headers: {
                    'x-rapidapi-host': apiHost,
                    'x-rapidapi-key': apiKey,
                },
            });
            // Verifica se há erro nos dados da API
            const errorMessage = data?.data?.metadata?.errorData?.errorMessage?.errorMessage;
            if (errorMessage) {
                throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
            }
            const hostId = data?.data?.metadata?.bookingPrefetchData?.hostId ?? null;// Assuming result has a hostId
            const hostName = data?.data?.metadata?.bookingPrefetchData?.hostName ?? null;
            if (!data || !data.data.metadata.bookingPrefetchData.hostId || !data.data.metadata.bookingPrefetchData.hostId) {
                throw new NotFoundException(
                    "Não foi possível encontrar o perfil"
                );
            }
            return { hostId, hostName };
        } catch (err: any) {
            if (axios.isAxiosError(err)) {
                if (err.response) {
                    throw new HttpException(
                        `Failed to fetch hostId: [${err.response.status}] ${JSON.stringify(err.response.data)}`,
                        err.response.status,
                    );
                }
                if (err.request) {
                    throw new HttpException(`Failed to fetch hostId: no response received - ${err.message}`, HttpStatus.BAD_GATEWAY);
                }
            }
            throw new HttpException(`Failed to fetch hostId: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAccommodationAndFee(
        propertyId: string,
        checkinDate: string,
        checkoutDate: string
    ): Promise<any> {
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
            console.log(data)
            // Se houver mensagem de erro no metadata
            const errorMessage = data?.data?.metadata?.errorData?.errorMessage?.errorMessage;
            if (errorMessage) {
                throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
            }

            const priceItems = data?.data?.priceBreakdown?.priceItems || [];

            const accommodationItem = priceItems.find(item => item.type === 'ACCOMMODATION');
            const guestFeeItem = priceItems.find(item => item.type === 'AIRBNB_GUEST_FEE');

            if (!accommodationItem || !guestFeeItem) {
                throw new HttpException('Price data not found', HttpStatus.NOT_FOUND);
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
            throw new HttpException(error.message || 'Unknown error', HttpStatus.BAD_REQUEST);
        }
    }


    async getPropertyDetails(propertyId: string): Promise<PropertyResponseDto> {
        const apiUrl = 'https://airbnb45.p.rapidapi.com/api/v1/getPropertyDetails';
        const apiKey = process.env.RAPIDAPI_KEY as string;
        const apiHost = 'airbnb45.p.rapidapi.com';

        try {
            const response = await axios.get(apiUrl, {
                params: { propertyId },
                headers: {
                    'x-rapidapi-host': apiHost,
                    'x-rapidapi-key': apiKey,
                },
            });

            const propertyData = response.data;
            const sharingConfig = propertyData?.data?.metadata?.sharingConfig;
            const houseRules = propertyData?.data?.section?.policiesDefault?.houseRules;



            return {
                bedrooms: this.extractNumber(sharingConfig?.title, 'bedroom'),
                beds: this.extractNumber(sharingConfig?.title, 'bed'),
                guestMaximum: this.extractNumber(houseRules?.[0]?.title, 'guest'),
            };
        } catch (err) {
            if (axios.isAxiosError(err)) {
                if (err.response) {
                    // API respondeu com erro (403, 404, 500...)
                    throw new Error(
                        `Failed to fetch property details: [${err.response.status}] ${JSON.stringify(err.response.data)}`
                    );
                } else if (err.request) {
                    // Nenhuma resposta recebida
                    throw new Error(`Failed to fetch property details: no response received - ${err.message}`);
                }
            }

            // Erro genérico (código, parse, etc.)
            throw new Error(`Failed to fetch property details: ${err.message}`);
        }

    }

    private extractNumber(text: string, keyword: string): number {
        if (!text) return 0;
        const regex = new RegExp(`(\\d+)\\s+${keyword}`, 'i');
        const match = text.match(regex);
        return match ? parseInt(match[1], 10) : 0;
    }

    async updateByIdDoAnuncio(id_do_anuncio: string, updateData: Partial<List>) {
        // Primeiro, busca o registro pelo id_do_anuncio
        const propriedade = await this.propriedades.findOne({
            where: { id_do_anuncio },
        });

        if (!propriedade) {
            throw new Error(`Propriedade com id_do_anuncio ${id_do_anuncio} não encontrada`);
        }

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
    async buscarAlertPorIdMock_bkp(id: string): Promise<APITypes> {
        // Simula delay opcional
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // Faz requisição GET para o Mockfly
            const response = await axios.get('https://raw.githubusercontent.com/thislucasdias/mock-para-testes/refs/heads/main/read.json');
            const jsonData = response.data;

            // Sobrescreve id e created_at
            const apiData: APITypes = Convert.toAPITypes(JSON.stringify({
                ...jsonData,
                id,
                created_at: new Date().toISOString()
            }));

            return apiData;
        } catch (error: any) {
            console.error('Erro ao buscar mock:', error.message || error);
            throw new Error('Falha ao buscar dados do mock');
        }
    }

    async getRoomPrice({
        roomId,
        checkIn,
        checkOut
    }) {
        const BASE_URL = 'http://pricing-airbnb-scraper-by-property-production.up.railway.app/getPriceByProperty';

        try {
            const response = await fetch(
                `${BASE_URL}?roomId=${encodeURIComponent(roomId)}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`,
                {
                    method: 'GET'
                }
            );

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();

            // Calcula diária com base no período
            const checkInDate = new Date(data.price.checkIn);
            const checkOutDate = new Date(data.price.checkOut);
            const numberOfNights = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

            const dailyPrice = data.price.raw / numberOfNights;

            const propriedadeAtualizado = await this.updateByIdDoAnuncio(roomId, {
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

    async getPropertyCoordinates(propertyId: string): Promise<PropertyCoordinatesDto | null> {
        const url = `https://airbnb45.p.rapidapi.com/api/v1/getPropertyDetails?propertyId=${propertyId}`;
        const headers = {
            'x-rapidapi-host': 'airbnb45.p.rapidapi.com',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY as string,
        };

        try {
            const response = await axios.get(url, {
                headers
            });
            const {
                data
            } = response.data;
            if (data && data.metadata && data.metadata.loggingContext && data.metadata.loggingContext.eventDataLogging) {
                const {
                    listingLat,
                    listingLng
                } = data.metadata.loggingContext.eventDataLogging;
                return {
                    latitude: listingLat,
                    longitude: listingLng
                };
            }
            return null;
        } catch (error) {
            console.error('Erro ao buscar detalhes da propriedade:', error);
            throw error;
        }
    };
    // Service
    async getRoomBasicInfo(roomId: string) {
        const BASE_URL = 'http://localhost:4000/airbnb/room-info';

        try {
            // Faz a requisição com axios usando params para query string
            const { data } = await axios.get(BASE_URL, {
                params: { roomId }
            });

            // Atualiza o banco com todos os campos da API
            await this.updateByIdDoAnuncio(roomId, {
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
                eventosUnicosFuturos: eventosUnicos.size
            };

            if (eventosUnicos.size > 0) {
                console.log(`📌 Usuário ${user.username} (${user.id}) possui ${eventosUnicos.size} eventos futuros únicos analisados.`);

                const enviado = await this.emailService.sendEmail(
                    user?.email,
                    user?.username,
                    "Novos eventos futuros",
                    eventosUnicos.size
                );

                if (enviado && enviado?.enviado) {
                    console.log(`✅ Email enviado com sucesso para o usuário ${user?.username}`);
                } else {
                    console.log(`❌ Falha ao enviar email para o usuário ${user?.username}`);
                }
            } else {
                console.log(`ℹ️ Nenhum evento futuro disponível no momento para o usuário ${user?.username}.`);
            }

            return relatorioUsuario;
        } catch (error) {
            console.error(`❌ Erro ao compilar eventos futuros para usuário ${userId}:`, error);
            return null;
        }
    }

    async buscarAddress(listId: string) {

        try {
            console.log("🔍 Buscando endereço com idAlertAirb válido...");
            const address = await this.addressRepository.findOne({
                where: {
                    list: { id: listId },
                    idAlertAirb: Not("no_id")
                },
            });

            const list = await this.propriedades.findOne({
                where: {
                    id: address?.list.id
                },
            });
            //fora do loop
            //const dadosAirbnb = await this.airbnbService.getFirstAvailablePrice(list?.id_do_anuncio);
            const dadosAirbnb = await this.airbnbService.getFirstAvailablePrice(list?.id_do_anuncio);

            if (!dadosAirbnb?.price?.status || !dadosAirbnb?.propertyDetails) {
                throw new Error('Não foi possível obter preço no Airbnb');
            }

            const alerts = await this.buscarAlertPorId(address?.idAlertAirb);

            console.log(dadosAirbnb)
            const maxObj = alerts.comps.reduce((prev, curr) =>
                curr.similarity_score > prev.similarity_score ? curr : prev
            );
            const propriedadeReferencia = await this.airbnbService.getFirstAvailablePrice(maxObj?.listingID);
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

            const promises = enderecoAnalises.map((element, index) =>
                limit(async () => {
                    try {
                        const evento = element?.evento;
                        const thereIsLatLong = evento?.latitude && evento?.longitude;

                        console.log(`🔍 [${index + 1}/${enderecoAnalises.length}] Analisando evento: ${evento?.id} (${evento?.nome ?? 'sem nome'})`);

                        if (thereIsLatLong) {
                            console.log("📍 Evento possui latitude e longitude. Executando cálculo de preço...");
                            await this.getPricingPropriedadeByEventAndByProperty(
                                address?.idAlertAirb,
                                address?.list?.id,
                                element?.evento?.id,
                                dadosAirbnb,
                                propriedadeReferencia,
                                alerts
                            );
                            console.log(`✅ [${index + 1}/${enderecoAnalises.length}] Cálculo finalizado para o evento: ${evento?.id}`);
                        } else {
                            console.log(`⚠️ [${index + 1}/${enderecoAnalises.length}] Evento não possui latitude e longitude. Pulando cálculo.`);
                        }
                    } catch (eventError) {
                        console.log(`❌ [${index + 1}/${enderecoAnalises.length}] Erro ao processar análise do evento:`, eventError);
                    }
                })
            );

            await Promise.all(promises); // aguarda todos os eventos processarem
            console.log("🏁 Finalizado o processamento de todas as análises do endereço");

            //await this.emailService.enviarEmailAvisandoQueOsDadosForamProcessados(address?.user?.email)

            const notificationContent: CreateNotificationDto = {
                title: "Análise Finalizada",
                description: "O Sistema analisou os eventos para a propriedade " + list?.titulo,
                redirectTo: "/dashboard",
                sendEmail: true,
            };
            this.emailService.enviarNotification(address?.user?.id, notificationContent);

            await this.compilarEventosFuturosPorUsuario(address?.user?.id)

        } catch (err) {
            console.log("❌ Erro ao buscar endereço ou análises:", err);
        }
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
                return;
            }

            const property = await this.propriedades.findOne({
                where: { id: listId }
            });
            if (!property) {
                console.log(`❌ Propriedade não encontrada: ${listId}`);
                return;
            }

            //const dadosAirbnb = await this.airbnbService.getFirstAvailablePrice(property?.id_do_anuncio);
            //const dadosAirbnb = await this.airbnbService.getFirstAvailablePrice(property?.id_do_anuncio);

            const address = await this.addressRepository.findOne({
                where: { list: { id: listId } },
            });

            if (!address) {
                console.log(`❌ Endereço não encontrado para listId: ${listId}`);
                return;
            }

            if (!alerts?.comps?.length) {
                console.log("⚠️ Nenhum comparativo encontrado nos alerts para o cálculo de preço");
                return;
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

            //aqui nao tá considerando o preço do imovel referencia, porque o imóvel tem um preço extremamente inferior maxObj.avg_booked_daily_rate_ltm)
            const result = this.pricingCalculateService.calcular({
                precoReferencia: Number(Number(PropriedadeReferenciaPricePerDay)),
                seuPrecoAtual: Number(minhaPropriedadePricePerDay),
                capacidadeReferencia: Number(maxObj.bedrooms ?? 1),
                suaCapacidade: Number(dadosAirbnb?.propertyDetails?.bedrooms ?? 1),
                banheiroReferencia: Number(maxObj.bathrooms),
                seuBanheiro: Number(dadosAirbnb?.propertyDetails?.bedrooms ?? 1),
                ocupacaoReferencia: Number(0),
                suaOcupacao: 0 !== undefined ? Number(0) : undefined,
                fatorLocalizacao: fatorLocalizacao !== undefined ? Number(fatorLocalizacao) : undefined,
            });



            console.log("precoReferencia:", Number(maxObj.avg_booked_daily_rate_ltm));
            console.log("seuPrecoAtual:", Number(dadosAirbnb?.price?.data?.accommodationCost));
            console.log("capacidadeReferencia:", Number(maxObj.bedrooms ?? 1));
            console.log("suaCapacidade:", Number(dadosAirbnb?.propertyDetails?.bedrooms ?? 1));
            console.log("banheiroReferencia:", Number(maxObj.bathrooms));
            console.log("seuBanheiro:", Number(dadosAirbnb?.propertyDetails?.bedrooms ?? 1));
            console.log("ocupacaoReferencia:", Number(0));
            console.log("suaOcupacao:", 0 !== undefined ? Number(0) : undefined);
            console.log("fatorLocalizacao:", fatorLocalizacao !== undefined ? Number(fatorLocalizacao) : undefined);

            console.log("💰 Resultado do cálculo de preço:", result);

            // --- Salvar no banco ---
            console.log("💾 Salvando análise de preço...");
            await this.analisePrecoRepository.save({
                endereco: address,
                evento: evento,
                usuarioProprietario: property?.user ?? null,
                distanciaSuaPropriedade: distanceFromMyPropertyToEvent,
                distanciaPropriedadeReferencia: distanceFromMyPropertyReferenceToEvent,
                precoSugerido: result.precoSugerido,
                seuPrecoAtual: result.seuPrecoAtual,
                diferencaPercentual: result.diferencaPercentual,
                recomendacao: result.recomendacao,
            });
            console.log("✅ Análise de preço salva com sucesso");

        } catch (err) {
            console.log(`❌ Erro no processamento de pricing para alertAirbId=${alertAirbId}, eventId=${eventId}:`, err);
        }
    }
    async getEventosByEnderecoForMap(
        enderecoId: string,
        page: number = 1,
        limit: number = 10,
        raio: number,
        dataInicial?: string, // string ISO opcional
        dataFinal?: string    // string ISO opcional
    ) {
        console.log("raio:", raio);

        // Define datas padrão caso não sejam fornecidas
        const startDate = dataInicial
            ? dayjs(dataInicial).startOf('day').toDate()
            : dayjs().startOf('day').toDate(); // hoje 00:00:00

        const endDate = dataFinal
            ? dayjs(dataFinal).endOf('day').toDate()
            : dayjs().add(7, 'day').endOf('day').toDate(); // daqui a 7 dias 23:59:59

        const [resultados, total] = await this.analisePrecoRepository.findAndCount({
            where: {
                endereco: { id: enderecoId },
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
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1); // dia 01 do mês atual
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

        if (enderecoId) {

            const [resultados, total] = await this.analisePrecoRepository.findAndCount({
                where: {
                    usuarioProprietario: { id: userId },
                    endereco: { id: enderecoId },
                    aceito: true, // ✅ filtra apenas aceitos
                    evento: { dataInicio: Between(inicioMes, fimMes) }
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
                    evento: { dataInicio: Between(inicioMes, fimMes) },
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
        dataInicial: string,
        page: number = 1,
        limit: number = 10,
    ) {
        const inicio = startOfMonth(new Date(dataInicial));
        const fim = addDays(inicio, 30);
        const [resultados, total] = await this.analisePrecoRepository.findAndCount({
            where: {
                endereco: { id: enderecoId },
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

        let total = null;

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