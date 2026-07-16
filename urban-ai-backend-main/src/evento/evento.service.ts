import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address } from 'src/entities/addresses.entity';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { Event } from 'src/entities/events.entity';
import { List } from 'src/entities/list.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { startOfDay } from 'date-fns';

@Injectable()
export class EventoService {
  constructor(
    @InjectRepository(AnaliseEnderecoEvento)
    private readonly analiseRepo: Repository<AnaliseEnderecoEvento>,
    @InjectRepository(List)
    private readonly propsRepository: Repository<List>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) { }

  async findEventosPorEnderecoPaginado(addressId: string, userId: string, page = 1, limit = 10) {
    if (!addressId) {
      throw new BadRequestException('propriedadeId e obrigatorio');
    }
    if (!userId) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    const address = await this.addressRepository.findOne({
      where: [
        { id: addressId, user: { id: userId } } as any,
        { id: addressId, list: { user: { id: userId } } } as any,
      ],
      relations: ['user', 'list', 'list.user'],
    });
    if (!address) {
      throw new ForbiddenException('Acesso negado para esta propriedade');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));

    const [analises, total] = await this.analiseRepo.findAndCount({
      where: {
        endereco: { id: addressId },
        usuarioProprietario: { id: userId },
        // 6a: usa dataFim (não dataInicio) para não esconder evento multi-dia
        // que começou antes de hoje mas ainda está rolando. dataFim é NOT NULL
        // (default = dataInicio no ingest), então single-day não muda.
        evento: { dataFim: MoreThanOrEqual(startOfDay(new Date())) },
      },
      relations: ['evento'],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data: analises.map((analise) => ({
        ...analise.evento,
        distancia_metros: analise?.distanciaMetros,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };

  }



  async findPropriedadesComEventos(userId: string) {
    return this.analiseRepo.find({
      where: {
        usuarioProprietario: { id: userId },
      },
      relations: {
        endereco: true,
        evento: true,
      },
      order: {
        criadoEm: 'DESC',
      },
    });
  }


  async getEvents(id: string) {
    const props = await this.propsRepository.find({
      where: {
        user: { id: id },
      },
      order: {
        titulo: 'ASC',
      },
    });

    return props;
  }

  async findEventosAnalisadosUnicos(usuarioId: string) {
    const eventos = await this.analiseRepo
      .createQueryBuilder('analise')
      .leftJoin('analise.evento', 'evento')
      .where('analise.usuarioProprietario.id = :usuarioId', { usuarioId })
      .select('DISTINCT evento.id', 'id')
      .getRawMany();

    // Agora buscar os eventos reais por esses IDs:
    const ids = eventos.map(e => e.id);

    if (ids.length === 0) return [];

    return this.analiseRepo.manager
      .getRepository('Event')
      .createQueryBuilder('evento')
      .whereInIds(ids)
      .getMany();
  }

  async findAllEventosPaginado(page: number, limit: number) {
    const [results, total] = await this.eventRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: results,
      total,
      page,
      last_page: Math.ceil(total / limit),
    };
  }

}
