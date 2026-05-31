import { BadRequestException, Injectable, Logger, HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { List } from "../entities/list.entity";
import axios, { AxiosError } from "axios";
import { User } from "../entities/user.entity";
import { Address } from "../entities/addresses.entity";
import { Event } from "../entities/events.entity";
import { PropriedadeService } from "src/propriedades/propriedade.service";
import { AirbnbService } from "src/airbnb/airbnb.service";
import { EmailService } from "src/email/email.service";
import { CreateNotificationDto } from "src/notifications/tdo/create-notification.dto";
import { getDiaria } from "src/util";
import { hasUsableBasePrice } from "src/pricing/base-price.util";

type Imovel = {
  id: string;
  titulo: string;
  pictureUrl: string;
  cep: string;
  numero: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  list: {
    id: string;
  };
};

const BRAZILIAN_UF_CODES = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const BRAZILIAN_STATE_NAMES: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  distrito_federal: "DF",
  espirito_santo: "ES",
  goias: "GO",
  maranhao: "MA",
  mato_grosso: "MT",
  mato_grosso_do_sul: "MS",
  minas_gerais: "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  rio_de_janeiro: "RJ",
  rio_grande_do_norte: "RN",
  rio_grande_do_sul: "RS",
  rondonia: "RO",
  roraima: "RR",
  santa_catarina: "SC",
  sao_paulo: "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const ADDRESS_PLACEHOLDERS = new Set([
  "a_definir",
  "indefinido",
  "undefined",
  "null",
  "n_a",
  "na",
  "nao_informado",
  "sem_informacao",
  "sem_endereco",
]);


@Injectable()
export class ConnectService {
  private readonly logger = new Logger(ConnectService.name);
  // Host antigo do endpoint de listagens
  private readonly RAPIDAPI_HOST_LISTINGS = "airbnb45.p.rapidapi.com";
  // Host do endpoint de preços
  private readonly RAPIDAPI_HOST_PRICING = "airbnb-search.p.rapidapi.com";
  private readonly RAPIDAPI_KEY: string;


  constructor(
    @InjectRepository(List) // Injetando o repositório da entidade List
    private readonly listRepo: Repository<List>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,

    private configService: ConfigService,
    private propriedadeService: PropriedadeService,

    private airbnbService: AirbnbService,
    private emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

  ) {
    this.RAPIDAPI_KEY = this.configService.get<string>("RAPIDAPI_KEY");

    if (!this.RAPIDAPI_KEY) {
      this.logger.warn("RAPIDAPI_KEY environment variable is not set");
    } else {
      const maskedKey = `${this.RAPIDAPI_KEY.substring(0, 4)}...${this.RAPIDAPI_KEY.substring(this.RAPIDAPI_KEY.length - 4)}`;
      this.logger.log(`RapidAPI Key configured: ${maskedKey}`);
    }
  }

  async getUserManagedListings(userId: string): Promise<List[]> {
    try {
      this.logger.log(`🔎 Buscando listagens para o usuário Airbnb com ID=${userId} (via scraping direto)`);

      // 1) Scraping direto na página de perfil do host
      const hostListings = await this.propriedadeService.scrapeHostListings(userId);

      if (!hostListings || hostListings.length === 0) {
        this.logger.warn(`⚠️ Nenhum imóvel encontrado via scraping para host ${userId}`);
        return [];
      }

      this.logger.log(`📦 Encontrados ${hostListings.length} room IDs. Enriquecendo dados...`);

      // 2) Para cada room, buscar dados detalhados (título, foto, etc.) via scrapeAirbnbListing
      const listings: List[] = [];
      for (const item of hostListings) {
        try {
          const scraped = await this.propriedadeService.scrapeAirbnbListing(item.roomId);

// O filtro rigoroso de hostId foi desativado temporariamente pois gerava conflito
          // entre o Profile ID de 18 dígitos e o Host ID numérico das propriedades reais.
          // Com a importação restrita ao GraphQL/Extractor seguro, os falsos positivos de fallback não ocorrerão.

          listings.push({
            id: scraped.roomId,
            id_do_anuncio: scraped.roomId,
            titulo: scraped.title || item.title || `Imóvel ${item.roomId}`,
            pictureUrl: scraped.pictureUrl || item.pictureUrl || '',
            ativo: false,
            user: { id: userId } as any,
            // Dados enriquecidos do scraping individual
            bedrooms: scraped.bedrooms,
            beds: scraped.beds,
            bathrooms: scraped.bathrooms,
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
            amenitiesCount: scraped.amenitiesCount,
            amenities: scraped.amenities,
            guests: scraped.guestCapacity,
            latitude: scraped.latitude,
            longitude: scraped.longitude,
          } as any);
        } catch (scrapeErr: any) {
          // Se falhar o enriquecimento, usa dados básicos do perfil
          this.logger.warn(`⚠️ Falha ao enriquecer room ${item.roomId}: ${scrapeErr.message}. Usando dados básicos.`);
          listings.push({
            id: item.roomId,
            id_do_anuncio: item.roomId,
            titulo: item.title || `Imóvel ${item.roomId}`,
            pictureUrl: item.pictureUrl || '',
            ativo: false,
            user: { id: userId } as any,
          } as any);
        }
      }

      this.logger.log(`✅ ${listings.length} listagens prontas para o host ${userId}`);
      return listings;

    } catch (err) {
      this.logger.error(
        `❌ Erro ao buscar listagens via scraping:`,
        err instanceof Error ? err.stack : String(err),
      );
      return [];
    }
  }


  // MÉTODO 2 - BUSCAR O VALOR EM REAIS DE HOJE ATÉ 3 DIAS DEPOIS
  async getListingTotalPriceBRLForNext3Days(id: string): Promise<{
    total: number;
    currency: string;
    breakdown?: any;
    checkin: string;
    checkout: string;
  }> {
    const API_URL = "https://airbnb-search.p.rapidapi.com/property/get-price";

    const now = new Date();
    const checkin = now.toISOString().slice(0, 10);
    const checkoutDate = new Date(now);
    checkoutDate.setDate(now.getDate() + 3);
    const checkout = checkoutDate.toISOString().slice(0, 10);

    const useAirbnbSearchService = process.env.AIRBNB_PRICE_PROVIDER !== "legacy-connect";
    if (useAirbnbSearchService) {
      try {
        this.logger.log(
          `Buscando preço via airbnb-search para listing ${id} (${checkin} a ${checkout})`,
        );
        const quote = await this.airbnbService.getPriceForDateWindow(id, checkin, checkout);
        const total = Number(quote.price.data.accommodationCost);

        return {
          total,
          currency: "BRL",
          breakdown: {
            ...quote.price.data,
            dailyPrice: quote.nights ? Number((total / quote.nights).toFixed(2)) : total,
            nights: quote.nights,
            source: quote.source,
          },
          checkin,
          checkout,
        };
      } catch (err) {
        this.logger.error(
          `Erro ao buscar preço do listing ${id}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new HttpException(
          "Falha ao buscar preço no Airbnb Search",
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    const params = {
      id,
      checkin,
      checkout,
      locale: "PT-BR",
      currency: "BRL",
    };

    try {
      this.logger.log(
        `🔎 Buscando preço para listing ${id} (${checkin} a ${checkout})`,
      );

      const response = await axios.get(API_URL, {
        headers: {
          "X-RapidAPI-Host": this.RAPIDAPI_HOST_PRICING,
          "X-RapidAPI-Key": this.RAPIDAPI_KEY,
        },
        params,
        timeout: 15000,
      });

      const { data, status } = response;
      this.logger.debug(`Resposta recebida: ${JSON.stringify(data)}`);

      if (status !== 200) {
        throw new Error(`RapidAPI retornou status ${status}`);
      }

      let total = 0;
      let currency = "BRL";
      let breakdown = {};

      if (data?.price_total || data?.data?.price_total) {
        total = Number(data.price_total || data.data.price_total);
        breakdown = data;
      } else if (data?.data?.price?.total) {
        total = Number(data.data.price.total);
        breakdown = data.data.price;
      } else if (data?.total) {
        total = Number(data.total);
        breakdown = data;
      } else {
        throw new Error("Formato inesperado da resposta do endpoint.");
      }

      return {
        total,
        currency,
        breakdown,
        checkin,
        checkout,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError;
        this.logger.error(
          `Erro: status ${axiosError.response?.status}, dados: ${JSON.stringify(axiosError.response?.data)}`,
        );
        if (axiosError.response?.status === 403) {
          throw new HttpException(
            "Acesso à API proibido.",
            HttpStatus.FORBIDDEN,
          );
        }
        if (axiosError.response?.status === 404) {
          throw new HttpException(
            "Listing não encontrado.",
            HttpStatus.NOT_FOUND,
          );
        }
      }
      this.logger.error(
        `Erro ao buscar preço do listing ${id}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new HttpException(
        "Falha ao buscar preço — consulte os logs do servidor",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }



  async getAddressByCep(cep: string): Promise<any> {
    const API_URL = `https://brasilapi.com.br/api/cep/v2/${cep.replace(/\D/g, "")}`;

    try {
      this.logger.log(`🔎 Consultando endereço para o CEP ${cep}`);
      const response = await axios.get(API_URL, {
        timeout: 10000,
      });
      const { data, status } = response;

      this.logger.debug(
        `Resposta recebida da BrasilAPI: ${JSON.stringify(data)}`,
      );

      if (status !== 200) {
        throw new Error(`BrasilAPI retornou status ${status}`);
      }

      return data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError;
        this.logger.error(
          `Erro na consulta ao CEP: status ${axiosError.response?.status}, dados: ${JSON.stringify(axiosError.response?.data)}`,
        );
        if (axiosError.response?.status === 404) {
          throw new HttpException("CEP não encontrado.", HttpStatus.NOT_FOUND);
        }
      }
      this.logger.error(
        `Erro ao buscar CEP ${cep}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new HttpException(
        "Falha ao buscar informações do CEP — consulte os logs do servidor",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async saveProperties(properties: List[], userId: string): Promise<List[]> {
    this.logger.debug(`saveProperties received count=${properties.length} for user=${userId}`);
    try {
      this.logger.log(
        `Salvando ${properties.length} propriedades para o usuário ${userId}...`,
      );

      const savedProperties: List[] = [];

      for (const prop of properties) {
        // Busca registro existente pelo id_do_anuncio e user.id para garantir que seja do usuário certo
        const existing = await this.listRepo.findOne({
          where: { id_do_anuncio: prop.id_do_anuncio, user: { id: userId } },
        });

        if (existing) {
          // Atualiza campos relevantes, incluindo pictureUrl
          existing.titulo = prop.titulo;
          existing.pictureUrl = prop.pictureUrl;
          existing.ativo = prop.ativo;
          existing.user = { id: userId } as any;

          const updated = await this.listRepo.save(existing);
          savedProperties.push(updated);
        } else {
          // Cria novo registro com relacionamento user e pictureUrl
          const newProp = this.listRepo.create({
            titulo: prop.titulo,
            id_do_anuncio: prop.id_do_anuncio,
            pictureUrl: prop.pictureUrl,
            ativo: prop.ativo,
            user: { id: userId } as any,
          });

          const saved = await this.listRepo.save(newProp);
          savedProperties.push(saved);
        }
      }

      this.logger.log(`Propriedades salvas/atualizadas com sucesso.`);
      return savedProperties;
    } catch (error) {
      this.logger.error("Erro ao salvar propriedades:", error);
      throw new HttpException(
        "Erro ao salvar propriedades",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async countNewAddressSlotsForProperties(
    properties: Pick<List, 'id_do_anuncio'>[],
    userId: string,
  ): Promise<number> {
    const listingIds = [
      ...new Set(
        (properties ?? [])
          .map((property) => property?.id_do_anuncio)
          .filter(Boolean),
      ),
    ];

    return this.countNewAddressSlotsByListingIds(listingIds, userId);
  }

  async countNewAddressSlotsForAddresses(addresses: any[], userId: string): Promise<number> {
    const listingIds = [
      ...new Set(
        (addresses ?? [])
          .map((address) => address?.list?.id)
          .filter(Boolean),
      ),
    ];

    return this.countNewAddressSlotsByListingIds(listingIds, userId);
  }

  private async countNewAddressSlotsByListingIds(listingIds: string[], userId: string): Promise<number> {
    if (!listingIds.length) return 0;

    const existingAddressRows = await this.addressRepo
      .createQueryBuilder('address')
      .innerJoin('address.list', 'list')
      .select('list.id_do_anuncio', 'id_do_anuncio')
      .where('address.user_id = :userId', { userId })
      .andWhere('list.id_do_anuncio IN (:...listingIds)', { listingIds })
      .getRawMany<{ id_do_anuncio: string }>();

    const existingAddressListingIds = new Set(
      existingAddressRows.map((row) => row.id_do_anuncio),
    );

    return listingIds.filter((listingId) => !existingAddressListingIds.has(listingId)).length;
  }

  async getUserListingsByUserId(userId: string): Promise<List[]> {
    try {
      // Filtra os imóveis associados ao `userId` fornecido
      const listings = await this.listRepo.find({
        where: { user: { id: userId } },
        relations: ["user"], // Inclui o relacionamento com o usuário
      });
      if (!listings || listings.length === 0) {
        throw new Error("Nenhum imóvel encontrado para o usuário");
      }

      return listings; // Retorna a lista filtrada de imóveis do usuário
    } catch (error) {
      this.logger.error(
        `Erro ao buscar imóveis do usuário ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new HttpException(
        "Erro ao buscar imóveis do usuário",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private normalizeTextKey(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private getUsableAddressField(value: unknown): string | null {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = this.normalizeTextKey(trimmed);
    if (ADDRESS_PLACEHOLDERS.has(normalized)) return null;

    return trimmed;
  }

  private normalizeBrazilianState(value: unknown): string | null {
    const raw = this.getUsableAddressField(value);
    if (!raw) return null;

    const lettersOnly = raw.toUpperCase().replace(/[^A-Z]/g, "");
    if (lettersOnly.length === 2 && BRAZILIAN_UF_CODES.has(lettersOnly)) {
      return lettersOnly;
    }

    return BRAZILIAN_STATE_NAMES[this.normalizeTextKey(raw)] ?? null;
  }

  private extractDailyPriceFromQuote(quote: any): number | null {
    try {
      const daily = Number(getDiaria(quote));
      if (Number.isFinite(daily) && daily > 0) return Number(daily.toFixed(2));
    } catch {}

    const total = Number(quote?.price?.data?.accommodationCost);
    const nights = Number(quote?.nights);
    if (Number.isFinite(total) && total > 0 && Number.isFinite(nights) && nights > 0) {
      return Number((total / nights).toFixed(2));
    }

    if (Number.isFinite(total) && total > 0) return Number(total.toFixed(2));
    return null;
  }

  private async resolveListingBasePrice(list: List): Promise<Partial<List>> {
    const quote = await this.airbnbService.getFirstAvailablePrice(list.id_do_anuncio);
    const dailyPrice = this.extractDailyPriceFromQuote(quote);

    if (!dailyPrice || dailyPrice <= 0) {
      throw new Error("Cotação do Airbnb não trouxe diária válida.");
    }

    const total = Number(quote?.price?.data?.accommodationCost);
    const raw = Number.isFinite(total) && total > 0 ? Number(total.toFixed(2)) : dailyPrice;
    const source = quote?.source === "airbnb-search"
      ? "airbnb_search_checkout"
      : quote?.source === "airbnb-browser"
        ? "airbnb_headless_checkout"
        : "airbnb_checkout";

    return {
      dailyPrice,
      raw,
      priceText: `R$${dailyPrice.toFixed(2)}`,
      currency: "BRL",
      checkIn: quote?.checkIn ?? null,
      checkOut: quote?.checkOut ?? null,
      status: "preco_base_airbnb",
      pricingInputSource: source,
      pricingInputsUpdatedAt: new Date(),
    };
  }

  private publicErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === "string") return response;
      const message = (response as any)?.message;
      if (Array.isArray(message)) return message.join("; ");
      if (typeof message === "string") return message;
    }

    return error instanceof Error ? error.message : String(error);
  }

  private async createMultipleAddressesWithScrapedInputs(
    addresses: any[],
    userId: string,
  ): Promise<any[]> {
    const addressSaved: Address[] = [];
    const failures: Array<{ listingId: string | null; reason: string }> = [];
    const analysisStartedTitles: string[] = [];
    const basePricePendingTitles: string[] = [];

    this.logger.log(`Salvando ${addresses.length} ${addresses.length === 1 ? 'endereço' : 'endereços'} para o usuário ${userId}`);
    this.logger.debug(`createMultipleAddresses received count=${addresses.length}`);

    for (const addr of addresses) {
      const requestedListingId = addr?.list?.id ?? null;

      try {
        if (!requestedListingId) {
          throw new BadRequestException('Informe o ID do imóvel do Airbnb para concluir o cadastro.');
        }

        const list = await this.listRepo.findOne({
          where: {
            id_do_anuncio: requestedListingId,
            user: { id: userId },
          },
        });

        if (!list) {
          throw new NotFoundException('Não encontramos esse imóvel na sua conta. Confira o link do Airbnb e tente novamente.');
        }

        const userData = await this.userRepository.findOne({ where: { id: userId } });
        if (!userData) {
          throw new NotFoundException('Sua sessão expirou. Faça login novamente para continuar.');
        }

        this.logger.log(`[onboarding] Scraping room ${list.id_do_anuncio}...`);
        const scraped = await this.propriedadeService.scrapeAirbnbListing(list.id_do_anuncio);

        let pricePatch: Partial<List> = {};
        try {
          pricePatch = await this.resolveListingBasePrice(list);
          this.logger.log(
            `[onboarding] Preço base salvo para ${list.id_do_anuncio}: diária=${pricePatch.dailyPrice}`,
          );
        } catch (priceError) {
          this.logger.warn(
            `[onboarding] Não foi possível obter preço base para ${list.id_do_anuncio}: ${this.publicErrorMessage(priceError)}`,
          );
        }

        const listPatch: Partial<List> = {
          titulo: scraped.title || list.titulo,
          pictureUrl: scraped.pictureUrl || list.pictureUrl,
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
          ...pricePatch,
        };

        await this.listRepo.update(list.id, listPatch);
        Object.assign(list, listPatch);
        this.logger.log(`[onboarding] Dados enriquecidos salvos para ${list.id_do_anuncio}`);

        const existingAddress = await this.addressRepo.findOne({
          where: {
            list: { id: list.id },
            user: { id: userId },
          },
          relations: ['list', 'user'],
        });

        const city = this.getUsableAddressField(addr.cidade) ?? this.getUsableAddressField(scraped.city);
        const state = this.normalizeBrazilianState(addr.estado) ?? this.normalizeBrazilianState(scraped.state);
        const latitude = Number(scraped.latitude);
        const longitude = Number(scraped.longitude);

        if (!city || !state) {
          throw new BadRequestException(
            `Não foi possível validar cidade/UF do imóvel ${list.id_do_anuncio}. Confira o link do Airbnb ou complete o endereço antes de gerar recomendações.`,
          );
        }

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new BadRequestException(
            `Não foi possível obter latitude/longitude do imóvel ${list.id_do_anuncio}. Sem isso não conseguimos encontrar eventos próximos.`,
          );
        }

        const addressPayload = {
          cep: this.getUsableAddressField(addr.cep) ?? this.getUsableAddressField(scraped.zipCode) ?? '00000-000',
          numero: this.getUsableAddressField(addr.numero) ?? 'S/N',
          logradouro: this.getUsableAddressField(addr.logradouro) ?? this.getUsableAddressField(scraped.street),
          bairro: this.getUsableAddressField(addr.bairro) ?? this.getUsableAddressField(scraped.neighborhood),
          cidade: city,
          estado: state,
          latitude,
          longitude,
          list,
          user: { id: userId } as User,
          ativo: true,
          idAlertAirb: 'scraping_direct',
        };

        const addressEntity = existingAddress
          ? await this.addressRepo.save({ ...existingAddress, ...addressPayload })
          : await this.addressRepo.save(addressPayload);

        addressSaved.push(addressEntity);

        const hasBasePrice = hasUsableBasePrice(list);
        const title = list.titulo || list.id_do_anuncio;
        if (hasBasePrice) analysisStartedTitles.push(title);
        else basePricePendingTitles.push(title);
      } catch (error: any) {
        const reason = this.publicErrorMessage(error);
        failures.push({ listingId: requestedListingId, reason });
        this.logger.error(
          `Erro ao criar endereço no onboarding listing=${requestedListingId ?? 'desconhecido'}: ${reason}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    await this.sendAddressBatchNotifications(userId, {
      analysisStartedTitles,
      basePricePendingTitles,
    });

    if (failures.length > 0) {
      throw new BadRequestException({
        message: failures.length === addresses.length
          ? 'Não conseguimos concluir o cadastro dos imóveis selecionados.'
          : 'Alguns imóveis foram cadastrados, mas outros precisam de atenção.',
        savedCount: addressSaved.length,
        failedCount: failures.length,
        failures,
      });
    }

    return addressSaved.map(({ user, ...rest }) => {
      const { user: _, ...listWithoutUser } = rest.list || {};
      return {
        ...rest,
        list: listWithoutUser,
      };
    });
  }

  private async sendAddressBatchNotifications(
    userId: string,
    input: { analysisStartedTitles: string[]; basePricePendingTitles: string[] },
  ): Promise<void> {
    const send = async (notificationContent: CreateNotificationDto) => {
      const result = await this.emailService.enviarNotification(userId, notificationContent);
      if (!result?.enviado) {
        this.logger.warn(
          `Falha ao enviar notificação agregada de onboarding user=${userId}: ${result?.motivo ?? 'unknown'}`,
        );
      }
    };

    if (input.analysisStartedTitles.length > 0) {
      const count = input.analysisStartedTitles.length;
      await send({
        title: count === 1 ? 'Análise iniciada' : `Análise iniciada para ${count} imóveis`,
        description: count === 1
          ? `A Urban AI está analisando eventos perto de ${input.analysisStartedTitles[0]}.`
          : `A Urban AI está analisando eventos perto de ${count} imóveis: ${this.humanList(input.analysisStartedTitles)}.`,
        redirectTo: '/dashboard',
        sendEmail: false,
        sendPush: true,
        pushType: 'property_analysis_started_batch',
        metadata: {
          propertyTitles: input.analysisStartedTitles,
          count,
        },
      });
    }

    if (input.basePricePendingTitles.length > 0) {
      const count = input.basePricePendingTitles.length;
      await send({
        title: count === 1 ? 'Diária base pendente' : `Diária base pendente em ${count} imóveis`,
        description: count === 1
          ? `Informe a diária base de ${input.basePricePendingTitles[0]} para iniciar a análise da Urban AI.`
          : `Informe a diária base destes imóveis para iniciar a análise da Urban AI: ${this.humanList(input.basePricePendingTitles)}.`,
        redirectTo: '/properties',
        sendEmail: true,
        sendPush: false,
        pushType: 'base_price_pending_batch',
        metadata: {
          propertyTitles: input.basePricePendingTitles,
          count,
        },
      });
    }
  }

  private humanList(items: string[]): string {
    const clean = items.map((item) => item?.trim()).filter(Boolean);
    if (clean.length <= 3) return clean.join(', ');
    return `${clean.slice(0, 3).join(', ')} e mais ${clean.length - 3}`;
  }

  async createMultipleAddresses(
    addresses: any[],
    userId: string
  ): Promise<Address[] | any[]> {
    return this.createMultipleAddressesWithScrapedInputs(addresses, userId);

    let address: Address[] | [] = addresses;
    let addressSaved: Address[] = [];
    const analysisStartedTitles: string[] = [];
    const basePricePendingTitles: string[] = [];
    try {
      this.logger.log(
        `📍 Salvando ${addresses.length} endereço(s) para o usuário ${userId}`
      );

      this.logger.debug(`createMultipleAddresses received count=${address.length}`);

      for (const addr of addresses) {
        try {
          const list = await this.listRepo.findOne({
            where: {
              id_do_anuncio: addr.list.id,
              user: { id: userId },
            },
          });

          if (!list) {
            throw new NotFoundException('Não encontramos esse imóvel na sua conta. Confira o link do Airbnb e tente novamente.');
          }

          const userData = await this.userRepository.findOne({
            where: {
              id: userId
            }
          });
          if (!userData) {
            throw new NotFoundException('Sua sessão expirou. Faça login novamente para continuar.');
          }

          // ===== SCRAPING DIRETO (substitui RapidAPI) =====
          this.logger.log(`🕷️ [onboarding] Scraping room ${list?.id_do_anuncio}...`);
          const scraped = await this.propriedadeService.scrapeAirbnbListing(list?.id_do_anuncio);

          // Persistir dados enriquecidos na entity List
          if (list) {
            await this.listRepo.update(list.id, {
              titulo: scraped.title || list.titulo,
              pictureUrl: scraped.pictureUrl || list.pictureUrl,
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
            this.logger.log(`✅ [onboarding] Dados enriquecidos salvos para ${list.id_do_anuncio}`);
          }

          this.logger.debug(`Address linked to listing=${list?.id_do_anuncio}`);

          const existingAddress = await this.addressRepo.findOne({
            where: {
              list: { id: list.id },
              user: { id: userId },
            },
            relations: ['list', 'user'],
          });

          const isUsableAddressField = (value: unknown) =>
            typeof value === 'string' &&
            value.trim().length > 0 &&
            value.trim().toLowerCase() !== 'a definir';
          const city = isUsableAddressField(addr.cidade) ? addr.cidade.trim() : scraped.city?.trim();
          const stateRaw = isUsableAddressField(addr.estado) ? addr.estado.trim() : scraped.state?.trim();
          const state = stateRaw ? stateRaw.slice(0, 2).toUpperCase() : '';

          if (!city || !state) {
            throw new BadRequestException(
              `Não foi possível validar cidade/UF do imóvel ${list.id_do_anuncio}. Confira o link do Airbnb ou complete o endereço antes de gerar recomendações.`,
            );
          }

          const addressPayload = {
            cep: isUsableAddressField(addr.cep) ? addr.cep : scraped.zipCode || '00000-000',
            numero: isUsableAddressField(addr.numero) ? addr.numero : 'S/N',
            logradouro: isUsableAddressField(addr.logradouro) ? addr.logradouro : scraped.street || null,
            bairro: isUsableAddressField(addr.bairro) ? addr.bairro : scraped.neighborhood || null,
            cidade: city,
            estado: state,
            latitude: scraped.latitude,
            longitude: scraped.longitude,
            list: list,
            user: { id: userId } as User,
            ativo: true,
            idAlertAirb: 'scraping_direct',
          };

          const addressEntity = existingAddress
            ? await this.addressRepo.save({ ...existingAddress, ...addressPayload })
            : await this.addressRepo.save(addressPayload);

          addressSaved.push(addressEntity);

          const hasBasePrice =
            Number(list.manualDailyPrice) > 0 || Number(list.dailyPrice) > 0;
          const title = scraped.title || list?.titulo || list?.id_do_anuncio;
          if (hasBasePrice) analysisStartedTitles.push(title);
          else basePricePendingTitles.push(title);


        } catch (error: any) {
          this.logger.error(
            'Erro ao criar endereço no onboarding',
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      await this.sendAddressBatchNotifications(userId, {
        analysisStartedTitles,
        basePricePendingTitles,
      });
    } catch (error: any) {
      this.logger.debug(`Ocorreu um erro ao criar um address`);
    }

    const sanitized = addressSaved.map(({ user, ...rest }) => {
      const { user: _, ...listWithoutUser } = rest.list || {};
      return {
        ...rest,
        list: listWithoutUser,
      };
    });

    return sanitized;
  }

  async resolveUrl(shortUrl: string): Promise<string> {
    const response = await fetch(shortUrl, {
      redirect: 'follow',
    });

    return response.url; // já vem com a URL final
  }
}
