import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Repository } from 'typeorm';

@Injectable()
export class SugestionService {
  constructor(
    @InjectRepository(AnalisePreco)
    private readonly analisePrecoRepository: Repository<AnalisePreco>,
  ) {}

  async alterarAceito(id: string, aceito: boolean): Promise<AnalisePreco> {
    const registro = await this.analisePrecoRepository.findOneBy({ id });
    if (!registro) {
      throw new NotFoundException('Registro não encontrado');
    }
    registro.aceito = aceito;
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
    input: {
      precoAplicado: number;
      origem: 'manual_dashboard' | 'manual_off_platform' | 'stays_auto' | 'stays_user_accepted';
    },
  ): Promise<AnalisePreco> {
    const registro = await this.analisePrecoRepository.findOneBy({ id });
    if (!registro) {
      throw new NotFoundException('Registro não encontrado');
    }
    registro.aceito = true;
    registro.precoAplicado = input.precoAplicado;
    registro.aplicadoEm = new Date();
    registro.origemAplicacao = input.origem;
    return this.analisePrecoRepository.save(registro);
  }
}
