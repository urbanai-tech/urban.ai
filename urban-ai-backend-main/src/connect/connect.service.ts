import { Injectable, Logger, HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
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
    const API_URL = "https://airbnb45.p.rapidapi.com/api/v1/getUserManagedListing";

    try {
      this.logger.log(`🔎 Buscando listagens para o usuário Airbnb com ID=${userId}`);

      const response = await axios.get(API_URL, {
        headers: {
          "X-RapidAPI-Host": this.RAPIDAPI_HOST_LISTINGS,
          "X-RapidAPI-Key": this.RAPIDAPI_KEY,
        },
        params: { userId, page: 1 },
        timeout: 15000,
      });

      const { data, status } = response;

      if (status !== 200) {
        this.logger.warn(`⚠️ API retornou status inesperado ${status}`);
        return [];
      }

      if (!data?.data?.listings || !Array.isArray(data.data.listings)) {
        this.logger.warn(`⚠️ Resposta inesperada da API: ${JSON.stringify(data)}`);
        return [];
      }

      // Mapeia os dados da API para List[], incluindo pictureUrl
      const listings: List[] = data.data.listings.map((l) => ({
        id: String(l.id || ""),                    // id do banco será gerado ao salvar
        id_do_anuncio: String(l.id || ""),        // ID do anúncio na Airbnb
        titulo: l.nameOrPlaceholderName || l.name || "Listagem sem nome",
        pictureUrl: l.pictureUrl || "",           // URL da foto principal
        ativo: false,                             // default false
        user: { id: userId } as any,
      }));

      this.logger.log(`✅ Encontradas ${listings.length} listagens para o usuário ${userId}`);
      return listings;

    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // A API respondeu com status de erro
          this.logger.error(
            `❌ API retornou status ${err.response.status} com dados: ${JSON.stringify(err.response.data)}`
          );
        } else if (err.request) {
          // Nenhuma resposta recebida
          this.logger.error(`❌ Nenhuma resposta da API recebida. Request:`, err.request);
        } else {
          // Erro durante configuração da requisição
          this.logger.error(`❌ Erro na configuração da requisição Axios:`, err.message);
        }

        if (err.code === 'ECONNABORTED') {
          this.logger.warn('⚠️ Requisição excedeu o tempo limite (timeout)');
        }

      } else {
        // Qualquer outro tipo de erro
        this.logger.error(`❌ Erro inesperado ao buscar listagens:`, err instanceof Error ? err.stack : String(err));
      }

      // Retorna lista vazia para não quebrar a aplicação
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
    this.logger.debug(
      "▶️ Payload recebido em saveProperties:",
      JSON.stringify(properties, null, 2),
    );
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

  async getUserListingsByUserId(userId: string): Promise<List[]> {
    try {
      // Filtra os imóveis associados ao `userId` fornecido
      const listings = await this.listRepo.find({
        where: { user: { id: userId } },
        relations: ["user"], // Inclui o relacionamento com o usuário
      });
      console.log(listings);
      if (!listings || listings.length === 0) {
        throw new Error("Nenhum imóvel encontrado para o usuário");
      }

      return listings; // Retorna a lista filtrada de imóveis do usuário
    } catch (error) {
      console.error(error);
      throw new HttpException(
        "Erro ao buscar imóveis do usuário",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createMultipleAddresses(
    addresses: any[],
    userId: string
  ): Promise<Address[] | any[]> {
    let address: Address[] | [] = addresses;
    let addressSaved: Address[] = [];
    console.log(address)
    try {
      this.logger.log(
        `📍 Salvando ${addresses.length} endereço(s) para o usuário ${userId}`
      );

      console.log("endereços", address)

      for (const addr of addresses) {
        try {
          const list = await this.listRepo.findOne({
            where: {
              id_do_anuncio: addr.list.id,
              user: { id: userId },
            },
          });


          const userData = await this.userRepository.findOne({
            where: {
              id: userId
            }
          });
          if (!userData) {
            throw new NotFoundException(`Usuário com id ${userId} não encontrado`);
          }
          const existingAddress = await this.addressRepo.findOne({
            where: {
              list: { id: addr.list.id },
              user: { id: userId },
            },
            relations: ["list", "user"],
          });


          //chamar o create alert do airb
          //salvar o id 
          //chamar função para retornar latlongbylistid

          //this.prop
          const coordenates = await this.propriedadeService.getPropertyCoordinates(list?.id_do_anuncio)
          const dadosProperty = await this.airbnbService.getFirstAvailablePrice(list?.id_do_anuncio);
          const alert = await this.propriedadeService.criarAlertaAirbnb({
            latitude: coordenates?.latitude,
            longitude: coordenates?.longitude,
            accommodates: dadosProperty?.propertyDetails?.beds,
            bathrooms: 1,
            bedrooms: dadosProperty?.propertyDetails?.bedrooms
          });
          console.log("id list:", list?.id_do_anuncio)
          //console.log(alert)




          const addressEntity = await this.addressRepo.save({
            cep: addr.cep,
            numero: addr.numero,
            logradouro: addr.logradouro,
            bairro: addr.bairro,
            cidade: addr.cidade,
            estado: addr.estado,
            latitude: coordenates?.latitude,
            longitude: coordenates?.longitude,
            list: list, // Usa a instância da lista encontrada
            user: { id: userId } as User,
            ativo: true,
            idAlertAirb: alert?.id

          });

          addressSaved.push(addressEntity);
          //this.logger.debug(`Criando novo endereço para lista: ${list.id}`);


          // this.emailService.enviarEmailAvisandoQueOsDadosEstaoSendoProcessados(userData?.email)
          const notificationContent: CreateNotificationDto = {
            title: "Análise Iniciada",
            description: "O Sistema está analisando os eventos para sua popriedade " + list?.titulo,
            redirectTo: "/dashboard",
            sendEmail: true,
          };
          this.emailService.enviarNotification(userId, notificationContent);


        } catch (error: any) {
          console.error("Ocorreu um erro aqui", error);
        }
      }
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


