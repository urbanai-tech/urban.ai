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
import { UrbanAIPricingEngine } from '../knn-engine/pricing-engine';

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
    ) { 
        this.aiEngine = new UrbanAIPricingEngine();
    }
    
    private aiEngine: UrbanAIPricingEngine;

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

    // --- Mapa de tradução EN → PT-BR para tipos de imóvel ---
    private static readonly PROPERTY_TYPE_PT: Record<string, string> = {
        'Entire home': 'Casa inteira',
        'Entire rental unit': 'Apartamento inteiro',
        'Rental unit': 'Apartamento',
        'Entire serviced apartment': 'Apartamento com serviços',
        'Serviced apartment': 'Apartamento com serviços',
        'Private room': 'Quarto privado',
        'Shared room': 'Quarto compartilhado',
        'Entire villa': 'Villa inteira',
        'Entire condo': 'Condomínio inteiro',
        'Condo': 'Condomínio',
        'Entire loft': 'Loft inteiro',
        'Loft': 'Loft',
        'Entire guest suite': 'Suíte completa',
        'Guest suite': 'Suíte',
        'Entire place': 'Espaço inteiro',
        'Entire cottage': 'Chalé inteiro',
        'Cottage': 'Chalé',
        'Entire cabin': 'Cabana inteira',
        'Cabin': 'Cabana',
        'Entire bungalow': 'Bangalô inteiro',
        'Bungalow': 'Bangalô',
        'Tiny home': 'Mini casa',
        'Treehouse': 'Casa na árvore',
        'Houseboat': 'Barco-casa',
        'Home': 'Casa',
        'Room in a hotel': 'Quarto de hotel',
        'Room in a bed and breakfast': 'Quarto em pousada',
        'Room in a boutique hotel': 'Quarto em hotel boutique',
        'Aparthotel': 'Aparthotel',
        'Apartment': 'Apartamento',
        'Studio': 'Estúdio',
        'Guesthouse': 'Casa de hóspedes',
        'Farm stay': 'Estadia na fazenda',
        'Townhouse': 'Sobrado',
        'Castle': 'Castelo',
        'Boat': 'Barco',
        'Camper/RV': 'Trailer',
        'Tent': 'Barraca',
        'Yurt': 'Yurt',
        'Apartamento': 'Apartamento',
        'Casa': 'Casa',
    };

    private translatePropertyType(enType: string): string {
        // Busca exata
        if (PropriedadeService.PROPERTY_TYPE_PT[enType]) {
            return PropriedadeService.PROPERTY_TYPE_PT[enType];
        }
        // Busca case-insensitive
        const key = Object.keys(PropriedadeService.PROPERTY_TYPE_PT)
            .find(k => k.toLowerCase() === enType.toLowerCase());
        if (key) return PropriedadeService.PROPERTY_TYPE_PT[key];
        // Se já é PT ou desconhecido, retorna como está
        return enType;
    }

    // --- Mapa de estados brasileiros (extenso → sigla) ---
    private static readonly STATE_ABBR: Record<string, string> = {
        'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
        'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF',
        'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA',
        'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
        'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE',
        'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
        'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR',
        'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE',
        'Tocantins': 'TO',
    };

    // --- Reverse Geocoding via Nominatim (OpenStreetMap) ---
    private async reverseGeocode(lat: number, lng: number): Promise<{
        street: string;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        fullAddress: string;
    }> {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=pt-BR`;
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'UrbanAI/1.0 (contact@myurbanai.com)' },
                timeout: 10000,
            });

            const addr = data.address || {};
            const street = addr.road || addr.pedestrian || addr.footway || '';
            const neighborhood = addr.suburb || addr.neighbourhood || addr.city_district || '';
            const city = addr.city || addr.town || addr.municipality || addr.village || '';
            const stateRaw = addr.state || '';
            const state = PropriedadeService.STATE_ABBR[stateRaw] || stateRaw;
            const zipCode = addr.postcode || '';
            const fullAddress = data.display_name || '';

            console.log(`📍 [geocode] ${lat},${lng} → ${street}, ${neighborhood}, ${city}-${state} ${zipCode}`);
            return { street, neighborhood, city, state, zipCode, fullAddress };
        } catch (err: any) {
            console.warn(`⚠️ [geocode] Falha no reverse geocoding: ${err.message}`);
            return { street: '', neighborhood: '', city: '', state: '', zipCode: '', fullAddress: '' };
        }
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
            console.log(`🔎 [scrapeHost] Buscando listings do host ${userId} via GraphQL API... (Hash atual: ${queryHash?.substring(0, 10)}...)`);

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
                console.warn(`⚠️ [scrapeHost] Nenhum imóvel encontrado para host ${userId}`);
                return [];
            }

            console.log(`✅ [scrapeHost] Encontrados ${results.length} imóveis para host ${userId}: [${results.map(r => r.roomId).join(', ')}]`);
            return results;

        } catch (err: any) {
            console.error(`❌ [scrapeHost] Erro ao buscar listings via GraphQL (.com.br):`, err.message);

            // Fallback: tenta domínio .com internacional antes de desistir
            return this.scrapeHostListingsFallbackInternational(userId, queryHash, apiKey, variables, extensions, headers);
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
            console.log(`🔎 [scrapeHost:fallback-intl] Tentando domínio .com para host ${userId}...`);

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

            // Envia via MailerService
            const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
            const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });
            const sentFrom = new Sender(process.env.EMAIL_SENDER || 'noreply@notify.myurbanai.com', 'Urban AI System');
            const recipients = [new Recipient(adminEmail, 'Admin')];
            const emailParams = new EmailParams()
                .setFrom(sentFrom)
                .setTo(recipients)
                .setSubject(subject)
                .setHtml(htmlContent);
            
            await mailerSend.email.send(emailParams);

            console.log(`📧 [notifyAdmin] E-mail de alerta enviado para ${adminEmail}`);
        } catch (err: any) {
            console.error(`❌ [notifyAdmin] Falha ao enviar e-mail de alerta: ${err.message}`);
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
        // Scrape em EN para extração confiável de dados estruturados
        const url = `https://www.airbnb.com/rooms/${roomId}`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml',
        };

        try {
            console.log(`🕷️ [scrape] Extraindo dados do Airbnb para room ${roomId} (EN)...`);
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
            const segments = ogTitle.split(/\s*·\s*/).map(s => s.trim()).filter(Boolean);

            // --- Tipo e Localização (do OG title) ---
            let propertyTypeRaw = 'Unknown';
            let ogLocationHint = '';

            if (segments.length > 0) {
                const firstSeg = segments[0];
                const typeLocMatch = firstSeg.match(/^(.+?)\s+in\s+(.+)$/i);
                if (typeLocMatch) {
                    propertyTypeRaw = typeLocMatch[1].trim();
                    ogLocationHint = typeLocMatch[2].trim();
                } else {
                    propertyTypeRaw = firstSeg;
                    if (segments.length > 1 && !segments[1].startsWith('★') && !/^\d/.test(segments[1])) {
                        ogLocationHint = segments[1];
                    }
                }
            }

            // Traduz tipo para PT-BR
            const propertyType = this.translatePropertyType(propertyTypeRaw);

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
            const hostIdMatch = html.match(/"hostId":"(\d+)"/);
            const hostId = hostIdMatch ? String(hostIdMatch[1]) : null;

            // --- 📍 Reverse Geocoding: lat/lng → endereço completo ---
            let street = '', neighborhood = '', city = '', state = '', zipCode = '', fullAddress = '';

            if (latitude && longitude) {
                const geo = await this.reverseGeocode(latitude, longitude);
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

            console.log(`✅ [scrape] Room ${roomId}: "${title}" | ${latitude},${longitude} | ${bedrooms}q ${beds}c ${bathrooms}b | ★${rating}${isNewListing ? ' (New)' : ''} (${reviewCount} reviews) | 📍${street}, ${neighborhood}, ${city}-${state}`);

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
        } catch (err: any) {
            console.error(`❌ [scrape] Erro ao scrapear room ${roomId}:`, err.message);
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
                    await this.addressRepository.update(
                        { list: { id: prop.id } },
                        { latitude: scraped.latitude, longitude: scraped.longitude }
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
        // Tenta ambas as ordens de atributos
        const regex1 = new RegExp(`property="${property}"\\s+content="([^"]+)"`, 'i');
        const regex2 = new RegExp(`content="([^"]+)"\\s+property="${property}"`, 'i');
        const match = html.match(regex1) || html.match(regex2);
        return match ? match[1] : null;
    }

    private decodeHtmlEntities(str: string): string {
        return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
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
            hostId: null,
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
     * REFATORADO: Host ID não é extraível via scraping SSR.
     * Retorna null para hostId — o fluxo individual não depende dele.
     */
    async getPropertyHostId(propertyId: string): Promise<{ hostId: any | null, hostName: any | null }> {
        console.log(`⚠️ [getPropertyHostId] Host ID não disponível via scraping SSR para room ${propertyId}. Usando null.`);
        return { hostId: null, hostName: null };
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

            console.log("💰 Resultado do cálculo de preço (Matemático):", result);

            // --- Tentar Predição via IA (KNN) ---
            let precoFinalSugerido = result.precoSugerido;
            let percentualFinal = result.diferencaPercentual;
            let recomendacaoFinal = result.recomendacao;
            let motivoDaIA = "Cálculo Matemático Padrão (Fallback). Histórico insuficiente para IA intervir.";

            try {
                // Treinar a IA dinamicamente usando os comparáveis (Comps) da vizinhança!
                if(alerts.comps && alerts.comps.length > 0) {
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
                        metroDistance: 0.5, amenitiesCount: dadosAirbnb?.propertyDetails?.bedrooms ?? 1 
                    };
                    const eventoParaIA = { 
                        name: evento.nome || "Evento", lat: evento.latitude, lng: evento.longitude 
                    };

                    const prediCaaaoIA = await this.aiEngine.suggestPrice(minhaPropParaIA, eventoParaIA, Number(minhaPropriedadePricePerDay));
                    
                    if(prediCaaaoIA && prediCaaaoIA.suggestedPrice) {
                        precoFinalSugerido = Math.max(prediCaaaoIA.suggestedPrice, result.precoSugerido); // Mantém o melhor dos dois mundos pro cliente (maior lucro)
                        percentualFinal = prediCaaaoIA.increasePercentage;
                        recomendacaoFinal = (percentualFinal > 0) ? "Aumento de Receita Sugerido (IA)" : "Manutenção de Fator de Ocupação (IA)";
                        motivoDaIA = prediCaaaoIA.details.reasoning;
                        console.log(`🤖 IA KNN Ativada! Predição original KNN: R$${prediCaaaoIA.suggestedPrice} (+${percentualFinal}%). Motivo: ${motivoDaIA}`);
                    }
                }
            } catch (err) {
                console.error("⚠️ Falha ao predizer preço via IA (Falta de Histórico/Atributos). Acionando Fallback Matemático Integralmente:", err.message);
            }

            // --- Salvar no banco ---
            console.log("💾 Salvando análise de preço...");
            await this.analisePrecoRepository.save({
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