// processos.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Job } from 'bull';
import { PropertyDto } from 'src/maps/maps.controller';
import { MapsService } from 'src/maps/maps.service';

@Processor('processos')
export class ProcessosConsumer {
  private readonly logger = new Logger(ProcessosConsumer.name);

  constructor(
    private readonly mapsService: MapsService,
  ) { }

  @Process()
  async handle(job: Job<{ userId: string, propertyAdressId: string }>) {
    const { userId, propertyAdressId } = job.data;

    console.log(`🚀 Iniciando processamento para usuário ${userId}`);

      await this.analiseEndereçoPropriedadeByProperty('processar-propriedades-eventos-by-user-andpropertyId', userId, propertyAdressId);

  }
  private async analiseEndereçoPropriedadeByProperty(nome: string, userId: string, propertyAdressId: string) {
    console.log(`📡 Chamando rota: ${nome}`);

    const apiUrl = process.env.API_URL;

    try {
      // Primeira chamada
      console.log(`🏠 /Inicio analise para user:${userId}`);
      const analise = await this.mapsService.processarAnalisesByProperty(userId, propertyAdressId);
      console.log(`🏠 /home retornou:`, analise);
      console.log(`✅ Finalizada: ${nome}`);
    } catch (erro) {
      console.error(`❌ Erro ${nome}:`, erro);
    }
  }
  private async simularRota(nome: string) {
    console.log(`📡 Chamando rota: ${nome}`);

    const apiUrl = process.env.API_URL;

    try {
      // Primeira chamada
      console.log(`🏠 /Inicio updateAllEventsLatLng`);
      const latLongEvents = await this.mapsService.updateAllEventsLatLng();
      //const respostaHome = await axios.post(apiUrl + "/maps/processar-lat-long-eventos");
      console.log(`🏠 /home retornou:`, latLongEvents);

      // Aguarda 2 segundos antes da próxima
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Segunda chamada
      console.log(`🏠 /Inicio updateAllAddressLatLng`);
      const latLongAddress = await this.mapsService.updateAllAddressLatLng();
      //const respostaStatus = await axios.post(apiUrl + "/maps/processar-lat-long-adress");
      console.log(`📊 /status retornou:`, latLongAddress);

      // Outra chamada se necessário

      console.log(`🏠 /Inicio processar-analises`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const respostaDados = await axios.post(apiUrl + "/maps/processar-analises");
      console.log(`📂 /dados retornou:`, respostaDados.data);
      console.log(`✅ Finalizada: ${nome}`);
    } catch (erro) {
      console.error(`❌ Erro na rota ${nome}:`, erro);
    }
  }
  @Process('processar-pricing')
  async handleEvento(job: Job<{ listId: string }>) {
    const { listId } = job.data;
    console.log(`📅 Iniciando processamento para property ${listId}`);
    await this.simularRota('processar-lat-long-eventos');
    console.log(`✅ Finalizado processamento para property ${listId}`);
  }


}
