import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { HTTP_TIMEOUT_MS } from '../common/http-timeouts';
import { isEmptyScrapeSnapshot } from './scrape-snapshot.util';
import { escapeHtml } from '../common/escape-html';
import { Address } from 'src/entities/addresses.entity';
import { Repository } from 'typeorm';
import { List } from 'src/entities/list.entity';
import { AirbnbService } from 'src/airbnb/airbnb.service';
import { PropertyCoordinatesDto } from './tdo/property-coordinates.dto';
import { MailerService } from 'src/mailer/mailer.service';
import { AirbnbListingMetadataService } from './airbnb-listing-metadata.service';
import { parseCoordinates } from 'src/common/coordinates';
import {
    extractNumber,
    extractMetaContent,
    decodeHtmlEntities,
    extractHostIdFromAirbnbHtml,
} from './propriedade.helpers';

export class PropertyResponseDto {
    bedrooms: number;
    beds: number;
    guestMaximum: number;
}

/**
 * PropertyScrapingService — leitura de dados públicos do Airbnb usada no
 * onboarding e na manutenção do portfólio: anúncios do anfitrião (GraphQL com
 * fallbacks), scraping do anúncio (título, foto, capacidade, coordenadas,
 * hostId) e refresh periódico dos metadados dos imóveis.
 */
@Injectable()
export class PropertyScrapingService {
    /** Evita repetir o aviso de chave ausente a cada chamada. */
    private static missingWebApiKeyLogged = false;

    constructor(
        @InjectRepository(Address)
        private readonly addressRepository: Repository<Address>,
        @InjectRepository(List)
        private readonly propriedades: Repository<List>,
        @Inject(forwardRef(() => AirbnbService))
        private readonly airbnbService: AirbnbService,
        private readonly mailerService: MailerService,
        private readonly airbnbListingMetadataService: AirbnbListingMetadataService,
    ) {}

    // Hash do GraphQL lida do .env (AIRBNB_GRAPHQL_HASH) com fallback para o valor padrão conhecido
    private static readonly GRAPHQL_DEFAULT_HASH = 'cc10d90fbc2db4f1d74d42017017066b854e382f29d1273f32b6588d6ae25494';

    private get graphqlActiveHash(): string {
        return process.env.AIRBNB_GRAPHQL_HASH || PropertyScrapingService.GRAPHQL_DEFAULT_HASH;
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
        // Chave do cliente web do Airbnb: vem do ambiente (AIRBNB_WEB_API_KEY), nunca do código.
        const apiKey = process.env.AIRBNB_WEB_API_KEY?.trim();
        if (!apiKey) {
            if (!PropertyScrapingService.missingWebApiKeyLogged) {
                PropertyScrapingService.missingWebApiKeyLogged = true;
                console.error('🚨 [scrapeHost] AIRBNB_WEB_API_KEY não configurada: a consulta GraphQL do perfil foi pulada. Defina a variável (ver .env.example); usando o fallback por navegador.');
            }
            return this.scrapeHostListingsWithBrowserFallback(userId, 'missing-airbnb-web-api-key');
        }

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
                timeout: HTTP_TIMEOUT_MS.slow,
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
                if (!PropertyScrapingService.hashExpirationNotified) {
                    PropertyScrapingService.hashExpirationNotified = true;
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
                timeout: HTTP_TIMEOUT_MS.slow,
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
            const subject = '🚨 My Urban — Hash do Airbnb GraphQL Expirada';
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #e74c3c;">⚠️ Ação Necessária: Hash do Airbnb Expirada</h2>
                    <p>O sistema My Urban detectou que a <strong>hash do GraphQL do Airbnb</strong> expirou
                    (<code>${escapeHtml(expiredHash?.substring(0, 16))}...</code>). A importação de imóveis por host está
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
            const response = await axios.get(url, { headers, timeout: HTTP_TIMEOUT_MS.slow });
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
            const response = await axios.get(url, { headers, timeout: HTTP_TIMEOUT_MS.slow });
            const html: string = response.data;

            // --- Meta Tags OG ---
            const ogTitle = this.extractMetaContent(html, 'og:title') || `Imóvel ${roomId}`;
            const pictureUrl = this.decodeHtmlEntities(
                this.extractMetaContent(html, 'og:image') || ''
            );

            // --- Coordenadas (JSON embeddado) ---
            const latMatch = html.match(/"lat"\s*:\s*([-\d.]+)/);
            const lngMatch = html.match(/"lng"\s*:\s*([-\d.]+)/);
            // Par inválido (fora de faixa, 0,0, NaN) vira "sem coordenadas": nunca gravamos lixo.
            const parsedCoordinates = parseCoordinates(
                latMatch ? latMatch[1] : null,
                lngMatch ? lngMatch[1] : null,
            );
            const latitude = parsedCoordinates?.latitude ?? null;
            const longitude = parsedCoordinates?.longitude ?? null;

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
    async refreshAllPropertyMetadata(
        options: { filterOwners?: (ownerIds: string[]) => Promise<Set<string>> } = {},
    ): Promise<{ total: number; updated: number; errors: number }> {
        let allProperties = await this.propriedades.find({ where: { ativo: true } });
        if (options.filterOwners) {
            // Re-scraping custa API: só imóveis de donos com direito de uso E que ainda
            // têm um endereço ativo (os pausados por cota/downgrade ficam de fora).
            const ownerIds = [...new Set(allProperties.map((p) => p.user?.id).filter(Boolean))] as string[];
            const allowedOwners = await options.filterOwners(ownerIds);
            const activeRows = await this.addressRepository
                .createQueryBuilder('address')
                .select('DISTINCT address.list_id', 'listId')
                .where('address.ativo = :active', { active: true })
                .getRawMany<{ listId: string }>();
            const listsWithActiveAddress = new Set(activeRows.map((row) => row.listId));
            allProperties = allProperties.filter(
                (p) => p.user?.id && allowedOwners.has(p.user.id) && listsWithActiveAddress.has(p.id),
            );
        }
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
                if (isEmptyScrapeSnapshot(scraped)) {
                    // Leitura bloqueada/vazia: preserva o que já existe em vez de gravar zeros.
                    throw new Error('Leitura do Airbnb vazia');
                }
                // Plano B (ADR 0010): essenciais informados pelo anfitrião não são sobrescritos.
                const hostOwnsEssentials = prop.essentialsSource === 'host_input';
                await this.propriedades.update(prop.id, {
                    titulo: scraped.title,
                    pictureUrl: scraped.pictureUrl,
                    ...(hostOwnsEssentials
                        ? {}
                        : {
                            quartos: scraped.bedrooms,
                            camas: scraped.beds,
                            banheiros: scraped.bathrooms,
                            hospedes: scraped.guestCapacity,
                            propertyType: scraped.propertyType,
                            essentialsSource: 'airbnb',
                            essentialsUpdatedAt: new Date(),
                        }),
                    rating: scraped.rating,
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
}
