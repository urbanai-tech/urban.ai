import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
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

    this.logger.log(`Iniciando processamento para usuario ${userId}`);
    await this.analiseEnderecoPropriedadeByProperty(
      'processar-propriedades-eventos-by-user-andpropertyId',
      userId,
      propertyAdressId,
    );
  }

  private async analiseEnderecoPropriedadeByProperty(nome: string, userId: string, propertyAdressId: string) {
    this.logger.log(`Chamando rotina: ${nome}`);

    try {
      const analise = await this.mapsService.processarAnalisesByProperty(userId, propertyAdressId);
      this.logger.log(`Finalizada rotina ${nome}: ${JSON.stringify(analise)}`);
    } catch (erro) {
      this.logger.error(`Erro na rotina ${nome}`, erro instanceof Error ? erro.stack : String(erro));
      throw erro;
    }
  }

  @Process('processar-pricing')
  async handleEvento(job: Job<{ userId: string; propertyAdressId: string }>) {
    const { userId, propertyAdressId } = job.data;
    this.logger.log(`Iniciando processamento de pricing para property ${propertyAdressId}`);
    await this.analiseEnderecoPropriedadeByProperty(
      'processar-propriedades-eventos-by-user-andpropertyId',
      userId,
      propertyAdressId,
    );
    this.logger.log(`Finalizado processamento de pricing para property ${propertyAdressId}`);
  }
}
