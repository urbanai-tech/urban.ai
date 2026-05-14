import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Repository } from 'typeorm';

@Injectable()
export class SugestionService {
  constructor(
    @InjectRepository(AnalisePreco)
    private readonly analisePrecoRepository: Repository<AnalisePreco>,
  ) {}

  async alterarAceito(id: string, userId: string, aceito: boolean): Promise<AnalisePreco> {
    const registro = await this.analisePrecoRepository.findOne({
      where: { id },
      relations: ['usuarioProprietario'],
    });
    if (!registro) {
      throw new NotFoundException('Registro não encontrado');
    }
    if (registro.usuarioProprietario.id !== userId) {
      throw new ForbiddenException('Registro nao pertence ao usuario autenticado');
    }
    registro.aceito = aceito;
    registro.status = aceito ? 'accepted' : 'rejected';
    registro.aceitoEm = aceito ? new Date() : null;
    registro.rejeitadoEm = aceito ? null : new Date();
    return await this.analisePrecoRepository.save(registro);
  }

  /**
   * F6.1 Tier 3 — registra o preço REAL que o anfitrião aplicou após a sugestão.
   *
   * Este é o **ground truth do MAPE**: sem ele, não temos como validar se
   * a promessa "+30% receita" se cumpre. Pode ser chamado:
   *  - Pelo dashboard do anfitrião (origem='manual_dashboard') quando ele
   *    confirma "Sim, apliquei R$ X" após a sugestão
   *  - Automaticamente pelo Stays push (origem='stays_auto')
   *  - Por backfill admin (origem='manual_off_platform') quando o
   *    anfitrião declara em entrevista qual valor de fato aplicou
   *
   * Idempotente — múltiplas chamadas atualizam os campos para o último valor.
   */
  async registrarPrecoAplicado(
    id: string,
    userId: string,
    input: {
      precoAplicado: number;
      origem: 'manual_dashboard' | 'manual_off_platform' | 'stays_auto' | 'stays_user_accepted';
    },
  ): Promise<AnalisePreco> {
    const registro = await this.analisePrecoRepository.findOne({
      where: { id },
      relations: ['usuarioProprietario'],
    });
    if (!registro) {
      throw new NotFoundException('Registro não encontrado');
    }
    if (registro.usuarioProprietario.id !== userId) {
      throw new ForbiddenException('Registro nao pertence ao usuario autenticado');
    }
    registro.aceito = true;
    registro.precoAplicado = input.precoAplicado;
    registro.aplicadoEm = new Date();
    registro.origemAplicacao = input.origem;
    registro.status = input.origem.startsWith('stays') ? 'applied_stays' : 'applied_manual';
    registro.aceitoEm = registro.aceitoEm ?? new Date();
    registro.rejeitadoEm = null;
    registro.expiradoEm = null;
    return this.analisePrecoRepository.save(registro);
  }

  async expirarAntigas(daysValid = 30): Promise<{ expired: number }> {
    const cutoff = new Date(Date.now() - daysValid * 24 * 60 * 60 * 1000);
    const result = await this.analisePrecoRepository
      .createQueryBuilder()
      .update(AnalisePreco)
      .set({
        status: 'expired',
        expiradoEm: new Date(),
      })
      .where('criado_em < :cutoff', { cutoff })
      .andWhere('aceito = :aceito', { aceito: false })
      .andWhere("(status IS NULL OR status IN ('suggested', 'rejected'))")
      .execute();
    return { expired: result.affected ?? 0 };
  }

  async rejeitar(id: string, userId: string): Promise<AnalisePreco> {
    return this.alterarAceito(id, userId, false);
  }

  async aceitar(id: string, userId: string): Promise<AnalisePreco> {
    return this.alterarAceito(id, userId, true);
  }
}
