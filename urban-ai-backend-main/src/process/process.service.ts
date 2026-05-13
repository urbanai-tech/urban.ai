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

  // Garante que o registro unico exista ao iniciar o modulo
  async onModuleInit() {
    await this.ensureExists();
  }

  // Busca o status atual (unico registro)
  async getCurrentStatus(): Promise<ProcessStatus | null> {
    const [status] = await this.processStatus.find();
    return status ?? null;
  }

  // Atualiza o status (cria se nao existir, mas isso e garantido no onModuleInit)
  async updateStatus(
    status: ProcessState,
    errorMessage?: string,
  ): Promise<ProcessStatus> {
    let record = await this.getCurrentStatus();

    // Caso por algum motivo nao exista, cria
    if (!record) {
      record = await this.ensureExists();
    }

    record.status = status;
    record.errorMessage = errorMessage;

    return await this.processStatus.save(record);
  }

  async tryMarkRunning(
    staleAfterMs = 2 * 60 * 60 * 1000,
  ): Promise<{ started: boolean; status: ProcessStatus }> {
    const existing = await this.ensureExists();

    return this.processStatus.manager.transaction(async (manager) => {
      const record = await manager.findOne(ProcessStatus, {
        where: { id: existing.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!record) {
        const created = manager.create(ProcessStatus, { status: 'running' });
        return { started: true, status: await manager.save(created) };
      }

      const updatedAt = record.updatedAt?.getTime?.() ?? 0;
      const isStale = Date.now() - updatedAt > staleAfterMs;

      if (record.status === 'running' && !isStale) {
        return { started: false, status: record };
      }

      record.status = 'running';
      record.errorMessage = undefined;
      return { started: true, status: await manager.save(record) };
    });
  }

  // Cria o registro inicial se nao existir
  async ensureExists(): Promise<ProcessStatus> {
    const [existing] = await this.processStatus.find();
    if (existing) return existing;

    const newStatus = this.processStatus.create({ status: 'completed' });
    return await this.processStatus.save(newStatus);
  }
}
