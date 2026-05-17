import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { Event } from '../entities/events.entity';
import { MapsService } from '../maps/maps.service';

type PropertyAggregate = {
  addressId: string;
  lastAnalysisAt: string | null;
  futureRecommendationsCount: number;
  appliedRecommendationsCount: number;
};

@Injectable()
export class AdminPropertiesService {
  constructor(
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    private readonly mapsService: MapsService,
  ) {}

  async list(input: { limit?: number; search?: string }) {
    const take = this.resolveLimit(input.limit, 200, 5000);
    const addresses = await this.addressRepo.find({
      where: { ativo: true },
      relations: ['list', 'user', 'list.user'],
      take,
    });

    const rows = addresses
      .filter((address) => !!address.list?.id)
      .map((address) => this.toListRow(address));

    const filtered = this.applySearch(rows, input.search);
    const aggregates = await this.loadAggregates(filtered.map((row) => row.id));

    const items = filtered
      .map((row) => ({
        ...row,
        ...(aggregates.get(row.id) ?? {
          lastAnalysisAt: null,
          futureRecommendationsCount: 0,
          appliedRecommendationsCount: 0,
        }),
      }))
      .sort((a, b) => {
        const userCompare = String(a.userEmail ?? '').localeCompare(String(b.userEmail ?? ''));
        if (userCompare !== 0) return userCompare;
        return String(a.propertyName ?? '').localeCompare(String(b.propertyName ?? ''));
      });

    return {
      generatedAt: new Date().toISOString(),
      total: items.length,
      items,
    };
  }

  async detail(id: string) {
    const address = await this.findAddress(id);
    const [analyses, aggregates, nearbyEvents] = await Promise.all([
      this.analiseRepo.find({
        where: { endereco: { id: address.id } },
        relations: ['evento'],
        order: { criadoEm: 'DESC' },
        take: 25,
      }),
      this.loadAggregates([address.id]),
      this.loadNearbyEvents(address),
    ]);
    const base = this.toListRow(address);
    const aggregate = aggregates.get(address.id) ?? {
      addressId: address.id,
      lastAnalysisAt: null,
      futureRecommendationsCount: 0,
      appliedRecommendationsCount: 0,
    };

    return {
      ...base,
      ...aggregate,
      street: address.logradouro ?? null,
      number: address.numero ?? null,
      neighborhood: address.bairro ?? address.list?.neighborhood ?? null,
      averageMonthlyRevenue: this.toNumberOrNull(address.list?.averageMonthlyRevenue),
      dailyPrice: this.toNumberOrNull(address.list?.dailyPrice),
      createdAt: this.toIso(address.created_at),
      updatedAt: this.toIso(address.updated_at),
      image_url: address.list?.pictureUrl ?? null,
      airbnbListingId: address.list?.id_do_anuncio ?? null,
      recentAnalyses: analyses.map((analysis) => this.toAnalysisRow(analysis)),
      nearbyEvents,
    };
  }

  async reprocess(id: string) {
    const address = await this.findAddress(id);
    const userId = address.user?.id ?? address.list?.user?.id;
    const listId = address.list?.id;

    if (!userId || !listId) {
      throw new BadRequestException('Imovel sem usuario ou listing associado para reprocessar');
    }

    const result = await this.mapsService.processarAnalisesByProperty(userId, listId);
    return {
      propertyId: address.id,
      listId,
      userId,
      generatedAt: new Date().toISOString(),
      result,
    };
  }

  private async findAddress(id: string) {
    const address = await this.addressRepo.findOne({
      where: { id },
      relations: ['list', 'user', 'list.user'],
    });
    if (!address?.list?.id) {
      throw new NotFoundException('Imovel nao encontrado');
    }
    return address;
  }

  private async loadAggregates(addressIds: string[]) {
    const aggregates = new Map<string, PropertyAggregate>();
    if (addressIds.length === 0) return aggregates;

    const now = new Date();
    const rows = await this.analiseRepo
      .createQueryBuilder('a')
      .innerJoin('a.endereco', 'endereco')
      .leftJoin('a.evento', 'evento')
      .select('endereco.id', 'addressId')
      .addSelect('MAX(a.criadoEm)', 'lastAnalysisAt')
      .addSelect(
        'SUM(CASE WHEN evento.dataInicio >= :now THEN 1 ELSE 0 END)',
        'futureRecommendationsCount',
      )
      .addSelect(
        'SUM(CASE WHEN a.precoAplicado IS NOT NULL THEN 1 ELSE 0 END)',
        'appliedRecommendationsCount',
      )
      .where('endereco.id IN (:...addressIds)', { addressIds })
      .setParameter('now', now)
      .groupBy('endereco.id')
      .getRawMany();

    for (const row of rows) {
      aggregates.set(row.addressId, {
        addressId: row.addressId,
        lastAnalysisAt: this.toIso(row.lastAnalysisAt),
        futureRecommendationsCount: Number(row.futureRecommendationsCount ?? 0),
        appliedRecommendationsCount: Number(row.appliedRecommendationsCount ?? 0),
      });
    }

    return aggregates;
  }

  private async loadNearbyEvents(address: Address) {
    const events = await this.eventRepo.find({
      where: {
        ativo: true,
        outOfScope: false,
        dataInicio: MoreThanOrEqual(new Date()),
      } as any,
      order: { dataInicio: 'ASC' },
      take: 300,
    });

    const addressLat = this.toNumberOrNull(address.latitude);
    const addressLng = this.toNumberOrNull(address.longitude);
    const addressCity = this.normalizeText(address.cidade);
    const addressState = this.normalizeText(address.estado);

    return events
      .map((event) => {
        const eventLat = this.toNumberOrNull(event.latitude);
        const eventLng = this.toNumberOrNull(event.longitude);
        const distanceMeters =
          addressLat != null && addressLng != null && eventLat != null && eventLng != null
            ? this.distanceMeters(addressLat, addressLng, eventLat, eventLng)
            : null;
        const sameCity = addressCity && this.normalizeText(event.cidade) === addressCity;
        const sameState = addressState && this.normalizeText(event.estado) === addressState;

        return {
          id: event.id,
          nome: event.nome,
          dataInicio: this.toIso(event.dataInicio),
          cidade: event.cidade ?? null,
          estado: event.estado ?? null,
          distanciaMetros: distanceMeters,
          relevancia: this.toNumberOrNull(event.relevancia),
          hasCoords: eventLat != null && eventLng != null,
          sameCity,
          sameState,
        };
      })
      .filter((event) => {
        if (event.distanciaMetros != null) return event.distanciaMetros <= 50_000;
        return event.sameCity || event.sameState;
      })
      .sort((a, b) => {
        if (a.distanciaMetros != null && b.distanciaMetros != null) {
          return a.distanciaMetros - b.distanciaMetros;
        }
        if (a.distanciaMetros != null) return -1;
        if (b.distanciaMetros != null) return 1;
        return String(a.dataInicio ?? '').localeCompare(String(b.dataInicio ?? ''));
      })
      .slice(0, 20);
  }

  private toListRow(address: Address) {
    const list = address.list;
    const owner = address.user ?? list?.user;
    return {
      id: address.id,
      addressId: address.id,
      listId: list?.id ?? null,
      propertyName: list?.titulo ?? '(sem nome)',
      userId: owner?.id ?? null,
      userEmail: owner?.email ?? null,
      city: address.cidade ?? null,
      state: address.estado ?? null,
      latitude: this.toNumberOrNull(address.latitude),
      longitude: this.toNumberOrNull(address.longitude),
      manualDailyPrice: this.toNumberOrNull(list?.manualDailyPrice ?? list?.dailyPrice),
      active: Boolean(address.ativo && (list?.ativo ?? true)),
    };
  }

  private toAnalysisRow(analysis: AnalisePreco) {
    return {
      id: analysis.id,
      eventoNome: analysis.evento?.nome ?? null,
      dataInicio: this.toIso(analysis.evento?.dataInicio),
      precoAtual: this.toNumberOrNull(analysis.seuPrecoAtual),
      precoSugerido: this.toNumberOrNull(analysis.precoSugerido),
      precoAplicado: this.toNumberOrNull(analysis.precoAplicado),
      diferencaPercentual: this.toNumberOrNull(analysis.diferencaPercentual),
      status: analysis.status ?? null,
      aceito: Boolean(analysis.aceito),
      criadoEm: this.toIso(analysis.criadoEm),
    };
  }

  private applySearch<T extends { propertyName?: string | null; userEmail?: string | null; city?: string | null; state?: string | null }>(
    rows: T[],
    search?: string,
  ) {
    const needle = this.normalizeText(search);
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.propertyName, row.userEmail, row.city, row.state]
        .map((value) => this.normalizeText(value))
        .some((value) => value.includes(needle)),
    );
  }

  private resolveLimit(value: number | undefined, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(max, Math.floor(parsed)));
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toIso(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusMeters = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
}
