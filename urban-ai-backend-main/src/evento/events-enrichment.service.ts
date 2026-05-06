import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { Event } from 'src/entities/events.entity';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Enriquecimento via Gemini (relevancia + raioImpactoKm + capacidadeEstimada).
 *
 * Cron a cada 1h pega lote de até 20 eventos:
 *   - relevancia IS NULL (nunca foi enriquecido OU teve falha mas será retry)
 *   - outOfScope = false (não gasta Gemini com eventos fora da cobertura)
 *   - enrichmentAttempts < MAX_ATTEMPTS
 *   - enrichmentLastAttemptAt IS NULL OU já passou RETRY_INTERVAL_HOURS
 *
 * Em sucesso: salva relevancia/raio/capacidade + zera enrichmentLastError +
 * incrementa attempts (auditoria).
 *
 * Em falha: incrementa attempts + salva timestamp + grava error message.
 * NÃO seta relevancia=0 (esse era o bug do limbo). Próxima rodada re-tenta
 * após RETRY_INTERVAL_HOURS, até MAX_ATTEMPTS. Após esgotar, evento fica
 * com relevancia=null permanente (admin pode investigar manualmente).
 */
@Injectable()
export class EventsEnrichmentService {
  private readonly logger = new Logger(EventsEnrichmentService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private isProcessing = false;

  /** Quantas tentativas antes de desistir. */
  private readonly MAX_ATTEMPTS = 3;

  /** Horas entre re-tentativas após falha. */
  private readonly RETRY_INTERVAL_HOURS = 24;

  /** Quantos eventos por rodada (cap conservador pra não estourar Gemini). */
  private readonly BATCH_SIZE = 20;

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn(
        'GEMINI_API_KEY não configurada. Enriquecimento de eventos (IA) está inativo até a chave ser inserida.',
      );
    }
  }

  // Executa de hora em hora
  @Cron('0 * * * *')
  async handleCron() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.enrichPendingEvents();
    } catch (error) {
      this.logger.error('Erro geral no enriching de eventos', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async enrichPendingEvents() {
    if (!this.genAI) {
      return;
    }

    const cutoff = new Date(Date.now() - this.RETRY_INTERVAL_HOURS * 60 * 60 * 1000);

    const pendingEvents = await this.eventsRepository.find({
      where: [
        // Nunca tentou
        {
          relevancia: IsNull(),
          outOfScope: false,
          enrichmentLastAttemptAt: IsNull(),
          enrichmentAttempts: LessThan(this.MAX_ATTEMPTS),
        },
        // Tentou mas faz mais de 24h e ainda < MAX_ATTEMPTS
        {
          relevancia: IsNull(),
          outOfScope: false,
          enrichmentLastAttemptAt: LessThan(cutoff),
          enrichmentAttempts: LessThan(this.MAX_ATTEMPTS),
        },
      ],
      take: this.BATCH_SIZE,
    });

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.log(`Enriquecendo ${pendingEvents.length} eventos via Gemini AI...`);
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    for (const event of pendingEvents) {
      const now = new Date();
      try {
        const prompt = `Você é um perito em análise inteligente de eventos (shows, congressos, teatros) no Brasil focado no impacto de hospitalidade e aluguéis de temporada (AirBnb).
Eu tenho o seguinte evento:
Nome: ${event.nome}
Descrição: ${event.descricao || 'Sem descrição detalhada'}
Local: ${event.cidade} - ${event.estado}
Categoria: ${event.categoria || 'Não informada'}

Você precisa analisar a magnitude deste evento e prever seu impacto geoturístico.
Responda APENAS com um Dicionário objeto JSON puro. Sem formatação markdown de código, sem comentários e sem textos introdutórios. Dicionário no seguinte formato exato:
{
  "capacidadeEstimada": numero, // Estimativa do público diário esperado.
  "relevancia": numero, // Um score inteiro rigoroso de 1 a 100 de impacto. 100= Lollapalooza ou Rock in Rio (Super Mega Evento), 80= Estádio Cheio, 50= Centro de Convenções Normal, 15= Evento de Bairro ou de Nicho Cívico, 1= Curso de rua.
  "raioImpactoKm": numero // Até quantos km de distância do evento uma propriedade se beneficia? Ex: Mega Eventos Globais = 50km, Festas Médias = 15km, Teatros Bairro = 3km.
}`;

        const result = await model.generateContent(prompt);
        let rawResponse = result.response.text().trim();

        if (rawResponse.startsWith('```json')) {
          rawResponse = rawResponse.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (rawResponse.startsWith('```')) {
          rawResponse = rawResponse.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const stats = JSON.parse(rawResponse);

        if (stats.relevancia !== undefined && stats.raioImpactoKm !== undefined) {
          let relevancia = parseInt(stats.relevancia, 10);
          let raioImpactoKm = parseFloat(stats.raioImpactoKm);
          const capacidadeEstimada = parseInt(stats.capacidadeEstimada, 10) || null;

          if (Number.isNaN(relevancia)) relevancia = 10;
          if (Number.isNaN(raioImpactoKm)) raioImpactoKm = 5;

          await this.eventsRepository.update(
            { id: event.id },
            {
              relevancia,
              raioImpactoKm,
              capacidadeEstimada,
              enrichmentAttempts: (event.enrichmentAttempts ?? 0) + 1,
              enrichmentLastAttemptAt: now,
              enrichmentLastError: null,
            },
          );
          this.logger.log(
            `Evento '${event.nome}' enriquecido: rel=${relevancia}, raio=${raioImpactoKm}km, cap=${capacidadeEstimada}`,
          );
        } else {
          // JSON OK mas sem campos esperados — conta como falha pra retry
          throw new Error('Resposta Gemini sem campos relevancia/raioImpactoKm');
        }

        // Pequeno delay entre chamadas pra não estourar rate-limit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err: any) {
        const message = (err?.message ?? 'erro desconhecido').slice(0, 500);
        this.logger.warn(
          `Falha ao enriquecer evento ${event.id} (tentativa ${(event.enrichmentAttempts ?? 0) + 1}/${this.MAX_ATTEMPTS}): ${message}`,
        );
        await this.eventsRepository.update(
          { id: event.id },
          {
            // ⚠️ NÃO seta relevancia=0 (era o bug do limbo permanente).
            // relevancia continua null até sucesso ou esgotar tentativas.
            enrichmentAttempts: (event.enrichmentAttempts ?? 0) + 1,
            enrichmentLastAttemptAt: now,
            enrichmentLastError: message,
          },
        );
      }
    }
  }

  /**
   * Reseta retroativamente eventos que tinham `relevancia=0` (bug antigo).
   * Marca pra re-tentativa colocando relevancia=null e zerando attempts.
   *
   * Chamável via endpoint admin pra limpar limbo histórico.
   */
  async resetStaleZeroRelevance(): Promise<{ reset: number }> {
    const result = await this.eventsRepository
      .createQueryBuilder()
      .update(Event)
      .set({
        relevancia: null as any,
        enrichmentAttempts: 0,
        enrichmentLastAttemptAt: null,
        enrichmentLastError: null,
      })
      .where('relevancia = 0')
      .execute();
    const reset = result.affected ?? 0;
    this.logger.log(`Resetados ${reset} eventos com relevancia=0 (bug antigo) para re-tentativa.`);
    return { reset };
  }
}
