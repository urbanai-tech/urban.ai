import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProcessState, ProcessStatus } from 'src/entities/processStatus.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProcessService implements OnModuleInit {
  constructor(
    @InjectRepository(ProcessStatus)
    private readonly processStatus: Repository<ProcessStatus>,
  ) {}

  // Garante que o registro único exista ao iniciar o módulo
  async onModuleInit() {
    await this.ensureExists();
  }

  // Busca o status atual (único registro)
  async getCurrentStatus(): Promise<ProcessStatus | null> {
    const [status] = await this.processStatus.find();
    return status ?? null;
  }

  // Atualiza o status (cria se não existir — mas isso é garantido no onModuleInit)
  async updateStatus(
    status: ProcessState,
    errorMessage?: string,
  ): Promise<ProcessStatus> {
    let record = await this.getCurrentStatus();

    // Caso por algum motivo não exista, cria
    if (!record) {
      record = await this.ensureExists();
    }

    record.status = status;
    record.errorMessage = errorMessage;

    return await this.processStatus.save(record);
  }

  // Cria o registro inicial se não existir
  async ensureExists(): Promise<ProcessStatus> {
    const [existing] = await this.processStatus.find();
    if (existing) return existing;

    const newStatus = this.processStatus.create({ status: 'running' });
    return await this.processStatus.save(newStatus);
  }

  
}
