import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Raw, Repository, MoreThanOrEqual } from 'typeorm';

import { Client, TravelMode } from '@googlemaps/google-maps-services-js';

import { Event } from '../entities/events.entity';
import { Address } from '../entities/addresses.entity';
import { AnaliseEnderecoEvento } from '../entities/AnaliseEnderecoEvento.entity';
import axios from 'axios';
import { User } from 'src/entities/user.entity';
import pLimit from 'p-limit';
import { aproximadamenteOuMenor, calculateDistance, calculateDistanceHere } from 'src/util';
import { ProcessStatus } from 'src/entities/processStatus.entity';
import { ProcessService } from 'src/process/process.service';
import { EmailService } from 'src/email/email.service';
import { PropriedadeService } from 'src/propriedades/propriedade.service';

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY;
  private readonly client = new Client({});

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AnaliseEnderecoEvento)
    private readonly analysisRepo: Repository<AnaliseEnderecoEvento>,
    private readonly processService: ProcessService,
    private readonly emailService: EmailService,
    private readonly propriedadeService: PropriedadeService,
  ) { }

  /**
   * Atualiza lat/lng de um evento usando seu enderecoCompleto
   */
  async updateLatLngByEventId(eventId: string) {
    this.logger.log(`Iniciando geocodificação do evento ${eventId}`);
    const ev = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!ev) {
      this.logger.warn(`Evento não encontrado: ${eventId}`);
      return { ok: false, message: 'Evento não encontrado.' };
    }

    const endereco = ev.enderecoCompleto?.trim();
    if (!endereco) {
      this.logger.error(`O evento ${eventId} não possui enderecoCompleto.`);
      return { ok: false, message: 'Evento não possui endereço.' };
    }

    this.logger.debug(`Endereço para geocodificação: "${endereco}"`);
    try {
      // Chama a HERE Geocoding API
      const resp = await axios.get('https://geocode.search.hereapi.com/v1/geocode', {
        params: {
          q: `${endereco}, São Paulo, SP, Brasil`,
          apikey: process.env.HERE_API_KEY,
        },
      });

      const first = resp.data.items[0];
      if (!first) {
        this.logger.warn(`Nenhuma coordenada encontrada para: "${endereco}"`);
        return { ok: false, message: 'Não foi possível obter coordenadas.' };
      }

      ev.latitude = first.position.lat;
      ev.longitude = first.position.lng;
      await this.eventRepo.save(ev);
      this.logger.log(`Evento ${eventId} atualizado: lat=${first.position.lat}, lng=${first.position.lng}`);
      return { ok: true, lat: first.position.lat, lng: first.position.lng };
    } catch (err: any) {
      this.logger.error('Erro na geocodificação:', err.message || err);
      return { ok: false, message: err.message || 'Erro desconhecido' };
    }
  }


  async updateAllEventsLatLng() {
    this.logger.log('Iniciando geocodificação em lote de todos os eventos SEM coordenadas.');


    const events = await this.eventRepo.find({
      where: [
        { latitude: (IsNull()) },
        { longitude: (IsNull()) },
      ],
    });


    if (!events.length) {
      this.logger.log('Nenhum evento pendente de geocodificação.');
      return { ok: true, message: 'Nenhum evento pendente.' };
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [i, ev] of events.entries()) {
      const endereco = ev.enderecoCompleto?.trim();
      if (!endereco) {
        this.logger.warn(`Evento ${ev.id} ignorado: endereço vazio.`);
        continue;
      }

      this.logger.log(`(${i + 1}/${events.length}) Geocodificando: "${endereco}"...`);

      try {
        const resp = await axios.get('https://geocode.search.hereapi.com/v1/geocode', {
          params: {
            q: endereco,
            apikey: process.env.HERE_API_KEY,
          },
        });

        const first = resp.data.items[0];
        if (!first) {
          this.logger.warn(`(${i + 1}) Nenhum resultado de geocodificação para "${endereco}".`);
          errorCount++;
          errors.push({ id: ev.id, reason: 'Sem resultados de geocodificação' });
          continue;
        }

        ev.latitude = first.position.lat;
        ev.longitude = first.position.lng;

        await this.eventRepo.save(ev);
        this.logger.log(`(${i + 1}) Evento ${ev.id} salvo com sucesso. Coordenadas: [${ev.latitude}, ${ev.longitude}]`);
        successCount++;

      } catch (err) {
        this.logger.error(`(${i + 1}) Erro ao processar evento ${ev.id}: ${err.message}`);
        errorCount++;
        errors.push({ id: ev.id, reason: err.message });
      }

      // Delay entre requisições (evita rate limit)
      await new Promise(r => setTimeout(r, 200));
    }

    this.logger.log(`Geocodificação finalizada. Sucesso: ${successCount}, Erros: ${errorCount}`);
    return {
      ok: true,
      total: events.length,
      sucesso: successCount,
      erros: errorCount,
      detalhesErros: errors,
    };
  }


  async updateAllAddressLatLng() {
    this.logger.log('Iniciando geocodificação em lote de todos os eventos SEM coordenadas.');


    const events = await this.addressRepo.find({
      where: [
        { latitude: (IsNull()) },
        { longitude: (IsNull()) },
      ],
    });

    if (!events.length) {
      this.logger.log('Nenhum evento pendente de geocodificação.');
      return { ok: true, message: 'Nenhum evento pendente.' };
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [i, ev] of events.entries()) {
      const endereco = `${ev.logradouro}, ${ev.bairro}, ${ev.cidade}, ${ev.estado}, ${ev.numero}`;
      if (!endereco) {
        this.logger.warn(`Address ${ev.id} ignorado: endereço vazio.`);
        continue;
      }

      this.logger.log(`(${i + 1}/${events.length}) Geocodificando: "${endereco}"...`);

      try {
        const resp = await axios.get('https://geocode.search.hereapi.com/v1/geocode', {
          params: {
            q: endereco,
            apikey: process.env.HERE_API_KEY,
          },
        });

        const first = resp.data.items[0];
        if (!first) {
          this.logger.warn(`(${i + 1}) Nenhum resultado de geocodificação para "${endereco}".`);
          errorCount++;
          errors.push({ id: ev.id, reason: 'Sem resultados de geocodificação' });
          continue;
        }

        ev.latitude = first.position.lat;
        ev.longitude = first.position.lng;

        const saved = await this.addressRepo.save(ev);
        this.logger.log(`Saved: ${JSON.stringify(saved)}`);
        this.logger.log(`(${i + 1}) Address ${ev.id} salvo com sucesso. Coordenadas: [${ev.latitude}, ${ev.longitude}]`);
        successCount++;

      } catch (err) {
        this.logger.error(`(${i + 1}) Erro ao processar adress ${ev.id}: ${err.message}`);
        errorCount++;
        errors.push({ id: ev.id, reason: err.message });
      }

      // Delay entre requisições (evita rate limit)
      await new Promise(r => setTimeout(r, 200));
    }

    this.logger.log(`Geocodificação finalizada. Sucesso: ${successCount}, Erros: ${errorCount}`);
    return {
      ok: true,
      total: events.length,
      sucesso: successCount,
      erros: errorCount,
      detalhesErros: errors,
    };
  }


  /**
 * Retorna todos os eventos sem latitude ou longitude
 */
  async updatePendingEventsLatLngBatch(limit = 50, offset = 0) {
    // 1. Busca o próximo lote de eventos sem coordenada
    const events = await this.eventRepo.find({
      where: [
        { latitude: null },
        { longitude: null },
      ],
      take: limit,
      skip: offset,
      order: { createdAt: "ASC" },
    });

    if (!events.length) {
      this.logger.log('Nenhum evento pendente de geocodificação.');
      return { ok: true, updated: 0, failed: 0, total: 0 };
    }

    let updated = 0;
    let failed = 0;
    const results: any[] = [];

    for (const ev of events) {
      const endereco = ev.enderecoCompleto?.trim();
      if (!endereco) {
        failed++;
        results.push({ id: ev.id, ok: false, reason: 'Sem endereço' });
        continue;
      }
      try {
        const resp = await axios.get('https://geocode.search.hereapi.com/v1/geocode', {
          params: {
            q: `${endereco}, São Paulo, SP, Brasil`,
            apikey: process.env.HERE_API_KEY,
          },
        });
        const first = resp.data.items[0];
        if (!first) {
          failed++;
          results.push({ id: ev.id, ok: false, reason: 'Não encontrou coordenada' });
          continue;
        }
        ev.latitude = first.position.lat;
        ev.longitude = first.position.lng;
        await this.eventRepo.save(ev);
        updated++;
        results.push({ id: ev.id, ok: true, lat: ev.latitude, lng: ev.longitude });
        await new Promise(r => setTimeout(r, 200)); // delay para não tomar bloqueio
      } catch (err) {
        failed++;
        results.push({ id: ev.id, ok: false, reason: (err as any).message || 'Erro desconhecido' });
      }
    }

    return {
      ok: true,
      updated,
      failed,
      total: events.length,
      results, // Detalhes por evento
    };
  }

  async updateLatLongEventos() {
    const events = await this.eventRepo
      .createQueryBuilder("event")
      .where("event.latitude IS NULL OR event.latitude = '' OR event.latitude = 0")
      .andWhere("event.longitude IS NULL OR event.longitude = '' OR event.longitude = 0")
      .orderBy("event.createdAt", "ASC")
      .getMany();
    if (!events.length) {
      this.logger.log('Nenhum evento pendente de geocodificação.');
      return { ok: true, updated: 0, failed: 0, total: 0 };
    }
    return {
      ok: true,
      events,
      total: events.length,
    };
  }




  async processarAnalisesByProperty(userId: string, propertyAdressId: string) {

    try {
      console.log("📍 Iniciando preenchimento de dados lat/long em addresses...");
      await this.updateAllAddressLatLng();
      console.log("✅ Preenchimento de dados lat/long em addresses finalizado");

      console.log("📍 Iniciando preenchimento de dados lat/long em eventos...");
      await this.updateAllEventsLatLng();
      console.log("✅ Preenchimento de dados lat/long em eventos finalizado");
    } catch (error) {
      console.error("❌ Erro durante preenchimento inicial:", error);
    }

    try {
      const users = await this.userRepo.find({
        where: {
          distanceKm: Not(IsNull()),
          id: userId
        }
      });

      const [addresses, events] = await Promise.all([
        this.addressRepo.find({
          where: {
            list: { id: propertyAdressId },
            ativo: true,
            latitude: Not(IsNull()),
            longitude: Not(IsNull())
          },
        }),
        this.eventRepo.find({
          where: {
            ativo: true,
            latitude: Not(IsNull()),
            longitude: Not(IsNull()),
            dataInicio: MoreThanOrEqual(new Date())
          },
        })
      ]);

      const transportModes = ["car"];

      // Resumo inicial
      console.log("🔍 Resumo inicial do processamento:");
      console.log(`👤 Usuários encontrados: ${users.length}`);
      console.log(`🏠 Endereços encontrados: ${addresses.length}`);
      console.log(`🎉 Eventos encontrados: ${events.length}`);
      const totalPossiveis = users.length * addresses.length * events.length * transportModes.length;
      console.log(`⚡ Total de análises potenciais: ${totalPossiveis}`);
      console.log("🚀 Iniciando processamento...\n");

      const userLimit = pLimit(5);
      const analysisLimit = pLimit(10);

      let totalAnalises = 0;
      let analisesProcessadas = 0;

      const processUser = async (user: User) => {
        const distanceKm = user.distanceKm ?? 0;
        if (distanceKm === 0) return null;

        try {
          console.log(`🔹 Análise iniciada para o usuário ${user.id}`);
          const novasAnalises: any[] = [];
          const analysisTasks = [];

          for (const address of addresses) {
            for (const transport of transportModes) {
              for (const event of events) {
                analysisTasks.push(
                  analysisLimit(async () => {
                    try {
                      const distance = await calculateDistance(
                        address.latitude,
                        address.longitude,
                        event.latitude,
                        event.longitude
                      );

                      if (aproximadamenteOuMenor(distanceKm, distance)) {
                        const result = await calculateDistanceHere(
                          address.latitude,
                          address.longitude,
                          event.latitude,
                          event.longitude,
                          transport
                        );

                        const novaAnalise = this.analysisRepo.create({
                          evento: { id: event.id },
                          endereco: address,
                          usuarioProprietario: user,
                          distanciaMetros: result?.length,
                          duracaoSegundos: result?.baseDuration,
                          enviado: true,
                          transportMode: transport
                        });

                        novasAnalises.push(novaAnalise);
                        totalAnalises++;

                        // Mostrar compatível e salvo
                        console.log(`✅ Compatível e salvo: Endereço ${address.id} <-> Evento ${event.id}`);
                      }
                    } catch (innerError) {
                      console.error(
                        `❌ Erro no evento ${event.id} e endereço ${address.id} para o usuário ${user.id}:`,
                        innerError
                      );
                    } finally {
                      analisesProcessadas++;
                      if (
                        analisesProcessadas % 10 === 0 ||
                        analisesProcessadas === totalPossiveis
                      ) {
                        const perc = ((analisesProcessadas / totalPossiveis) * 100).toFixed(2);
                        console.log(`⏱ Progresso: ${analisesProcessadas}/${totalPossiveis} (${perc}%) ✅`);
                      }
                    }
                  })
                );

              }
            }
          }

          await Promise.all(analysisTasks);

          if (novasAnalises.length > 0) {
            const chunkSize = 3;
            let totalSalvos = 0;

            for (let i = 0; i < novasAnalises.length; i += chunkSize) {
              const chunk = novasAnalises.slice(i, i + chunkSize);
              await this.analysisRepo.save(chunk);

              totalSalvos += chunk.length;
              const perc = ((totalSalvos / novasAnalises.length) * 100).toFixed(2);
              console.log(`🎯 ${totalSalvos}/${novasAnalises.length} registros salvos (${perc}%)`);
            }

          }

          console.log(`🔹 Análise concluída para o usuário ${user.id}`);
          return { userId: user.id, addresses, events };
        } catch (userError) {
          console.error(`❌ Erro ao processar usuário ${user.id}:`, userError);
          const created = await this.processService.updateStatus("error");
          await this.addressRepo.update(
            { list: { id: propertyAdressId } }, // condição
            { analisado: "error" }          // novos valores
          );
          if (!created) throw new NotFoundException("Não salvou o erro porque o status não foi encontrado para criar");
          return null;
        }
      };

      const results = await Promise.all(users.map(user => userLimit(() => processUser(user))));
      const filtered = results.filter(Boolean);

      console.log(`🎯 Processamento finalizado. Total de análises realizadas: ${totalAnalises}`);

      //alterar status da propriedade para completed
 
      await this.propriedadeService.buscarAddress(propertyAdressId)
           await this.addressRepo.update(
        { list: { id: propertyAdressId } }, // condição
        { analisado: "completed" }          // novos valores
      );
      const created = await this.processService.updateStatus("completed");
      if (!created) throw new NotFoundException("Não salvou porque o status não foi encontrado para criar");

      // await this.emailService.compilarEventosUnicosUsuarios();




      return { ok: true };
    } catch (error) {
      const created = await this.processService.updateStatus("error");
      if (!created) throw new NotFoundException("Não salvou o erro porque o status não foi encontrado para criar");
      console.error("❌ Erro inesperado durante o processamento de análises:", error);
      return { ok: false, error: error.message };
    }
  }
  async processarAnalisesTodosUsuarios() {
    try {
      const users = await this.userRepo.find({ where: { distanceKm: Not(IsNull()) } });
      let totalAnalises = 0;
      console.log(`Encontrados ${users.length} usuários com distância definida.`);
      const updated = await this.processService.updateStatus('running');
      if (!updated) throw new NotFoundException('Não iniciou porque o Status não foi encontrado para atualizar');

      const limit = pLimit(5);

      const processUser = async (user: User) => {
        const distanceKm = user.distanceKm ?? 0;
        if (distanceKm === 0) return 0;

        try {
          const [addresses, events] = await Promise.all([
            this.addressRepo.find({
              where: {
                user: { id: user.id },
                ativo: true,
                latitude: Not(IsNull()),
                longitude: Not(IsNull())
              },
              take: 10,
            }),
            this.eventRepo.find({
              where: {
                ativo: true,
                latitude: Not(IsNull()),
                longitude: Not(IsNull())
              },
              take: 10,
            })
          ]);
          console.log(`Análise iniciada para o usuário ${user.id}`);
          for (const address of addresses) {
            const transportModes = ['car', 'bus', 'pedestrian'];

            for (const transport of transportModes) {
              for (const event of events) {
                try {
                  console.log(`Analisando endereço ${address.id} com evento ${event.id}: ${address.latitude},${address.longitude} | ${event.latitude},${event.longitude}`);
                  const distance = await calculateDistance(address.latitude, address.longitude, event.latitude, event.longitude);

                  if (aproximadamenteOuMenor(user?.distanceKm, distance)) {
                    const result = await calculateDistanceHere(
                      address.latitude,
                      address.longitude,
                      event.latitude,
                      event.longitude,
                      transport
                    );

                    const novaAnalise = this.analysisRepo.create({
                      evento: { id: event?.id },
                      endereco: address,
                      usuarioProprietario: user,
                      distanciaMetros: result?.length,
                      duracaoSegundos: result?.baseDuration,
                      enviado: true,
                      transportMode: transport
                    });

                    await this.analysisRepo.save(novaAnalise);
                  } else {
                    console.log("Nenhuma distancia fez match", user?.distanceKm, distance)
                  }

                  totalAnalises++;
                } catch (innerError) {
                  console.error(`Erro ao processar evento ${event.id} e endereço ${address.id} para o usuário ${user.id}:`, innerError);
                }
              }
            }
          }

          console.log(`Análise concluída para o usuário ${user.id}`);
          return {
            userId: user.id,
            addresses,
            events
          };
        } catch (userError) {
          console.error(`Erro ao processar usuário ${user.id}:`, userError);
          const created = await this.processService.updateStatus('error');
          if (!created) throw new NotFoundException('Não salvou o erro porque o status não foi encontrado para criar');
          return null;
        }
      };

      const results = await Promise.all(
        users.map(user => limit(() => processUser(user)))
      );
      const filtered = results.filter(Boolean); // remove nulls

      console.log(`Processamento finalizado. Total de análises realizadas: ${totalAnalises}`);
      const created = await this.processService.updateStatus('completed');
      if (!created) throw new NotFoundException('Não salvou porque o status não foi encontrado para criar');

      //compilar eventos e enviar notificação para o usuário 
      this.emailService.compilarEventosUnicosUsuarios();
      return { ok: true };
    } catch (error) {
      const created = await this.processService.updateStatus('error');
      if (!created) throw new NotFoundException('Não salvou o erro porque o status não foi encontrado para criar');
      console.error('Erro inesperado durante o processamento de análises:', error);
      return { ok: false, error: error.message };
    }
  }

}


