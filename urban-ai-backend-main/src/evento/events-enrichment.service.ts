import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from 'src/entities/events.entity';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class EventsEnrichmentService {
  private readonly logger = new Logger(EventsEnrichmentService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private isProcessing = false;

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY não configurada. Enriquecimento de eventos (IA) está inativo até a chave ser inserida.');
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

    // Processa batches
    const pendingEvents = await this.eventsRepository.find({
      where: {
        relevancia: null,
      },
      take: 20, // limite conservador
    });

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.log(`Enriquecendo ${pendingEvents.length} eventos via Gemini AI...`);
    const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

    for (const event of pendingEvents) {
      try {
        const prompt = `Você é um perito em análise inteligente de eventos (shows, congressos, teatros) no Brasil focado no impacto de hospitalidade e aluguéis de temporada (AirBnb).
Eu tenho o seguinte evento:
Nome: ${event.nome}
Descrição: ${event.descricao || 'Sem descrição detalhada'}
Local: ${event.cidade} - ${event.estado}
Categoria: ${event.categoria || 'Não informada'}

Você precisa analisar a magnitude deste evento e prever seu impacto geoturístico.
Responda APENAS com um Dicionário obheto JSON puro. Sem formatação markdown de código, sem comentários e sem textos introdutórios. Dicionário no seguinte formato exato:
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
            event.relevancia = parseInt(stats.relevancia, 10);
            event.raioImpactoKm = parseFloat(stats.raioImpactoKm);
            event.capacidadeEstimada = parseInt(stats.capacidadeEstimada, 10) || null;
            
            // Segurança
            if (isNaN(event.relevancia)) event.relevancia = 10;
            if (isNaN(event.raioImpactoKm)) event.raioImpactoKm = 5;
            
            await this.eventsRepository.save(event);
            this.logger.log(`Evento '${event.nome}' enriquecido: Relevância=${event.relevancia}, Raio=${event.raioImpactoKm}km.`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (err) {
        this.logger.error(`Falha ao enriquecer evento ID ${event.id}:`, err);
        // Marcamos como relevância = 0 para não travar a fila eternamente com o erro de JSON (mas poderíamos implementar dead-letter queue idealmente)
        event.relevancia = 0;
        await this.eventsRepository.save(event);
      }
    }
  }
}
