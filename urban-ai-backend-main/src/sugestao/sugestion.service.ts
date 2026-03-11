import { Injectable } from '@nestjs/common';
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
      throw new Error('Registro não encontrado');
    }

    registro.aceito = aceito;

    return await this.analisePrecoRepository.save(registro);
  }
}
