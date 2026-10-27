import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address } from 'src/entities/addresses.entity';
import { Between, Repository } from 'typeorm';
import { List } from 'src/entities/list.entity';
import { User } from 'src/entities/user.entity';
import { addDays } from 'date-fns';
import { PricingInputHistory } from 'src/entities/pricing-input-history.entity';
import { OccupancyHistory } from 'src/entities/occupancy-history.entity';
import {
    PublicListResponse,
    PublicAddressResponse,
    PublicPropertySetupStatus,
    sameMoney,
    dateOnly,
    normalizeOptionalText,
    normalizeOptionalMoney,
    normalizeOptionalInteger,
    normalizeDateOnly,
    normalizeOccupancyStatus,
    hasUsableCoordinates,
    formatLocationLabel,
    formatAddressLine,
    toPublicOccupancyRecord,
    toPublicList,
    toPublicAddress,
    buildPublicPropertySetupStatus,
} from './propriedade.helpers';

/**
 * PropertyPortfolioService — CRUD do portfólio do anfitrião: listagem e
 * remoção de imóveis, identidade, inputs de pricing (com histórico) e
 * histórico/registro manual de ocupação. Respostas sempre via DTO público.
 */
@Injectable()
export class PropertyPortfolioService {
    constructor(
        @InjectRepository(Address)
        private readonly addressRepository: Repository<Address>,
        @InjectRepository(List)
        private readonly propriedades: Repository<List>,
        @InjectRepository(PricingInputHistory)
        private readonly pricingInputHistoryRepository: Repository<PricingInputHistory>,
        @InjectRepository(OccupancyHistory)
        private readonly occupancyHistoryRepository: Repository<OccupancyHistory>,
    ) {}

    async findByUserId(
        userId: string,
        page = 1,
        limit = 10
    ): Promise<{ data: PublicAddressResponse[]; total: number; page: number; limit: number }> {
        const [data, total] = await this.addressRepository.findAndCount({
            where: { user: { id: userId }, ativo: true, list: { ativo: true } },
            relations: ['list'],
            skip: (page - 1) * limit,
            take: limit,
            order: { created_at: 'DESC' },
        });

        return { data: data.map((address) => this.toPublicAddress(address)), total, page, limit };
    }

    async findAddressById(id: string, userId: string): Promise<PublicAddressResponse | null> {
        const address = await this.addressRepository.findOne({
            where: { id, user: { id: userId } },
            relations: ["list", "user"],
        });
        return address ? this.toPublicAddress(address) : null;
    }

    async deleteAddressAndList(addressId: string, userId: string): Promise<void> {
        // 1. Buscar o endereço pelo ID e dono autenticado (junto com o list relacionado)
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ["list"],
        });

        if (!address) {
            throw new NotFoundException("Endereço não encontrado");
        }

        const listId = address.list?.id;

        // 2. Deletar o endereço primeiro (filho)
        await this.addressRepository.delete(address.id);

        // 3. Verificar se ainda existem outros endereços ligados ao mesmo list
        const remainingAddresses = await this.addressRepository.count({
            where: { list: { id: listId } },
        });

        // 4. Se não houver mais endereços ligados, deletar o list também
        if (remainingAddresses === 0 && listId) {
            await this.propriedades.delete(listId);
        }
    }

    async findPropertiesForDropdown(
        userId: string
    ): Promise<{
        id: string;
        propertyName: string;
        userId: string;
        latitude: number;
        longitude: number;
        manualDailyPrice: number | null;
        averageMonthlyRevenue: number | null;
        dailyPrice: number | null;
        pricingInputSource: string | null;
        pricingInputsUpdatedAt: Date | null;
        internalNickname: string | null;
        internalCode: string | null;
        cep: string | null;
        numero: string | null;
        logradouro: string | null;
        bairro: string | null;
        cidade: string | null;
        estado: string | null;
        addressLine: string | null;
        locationLabel: string | null;
        setupStatus: PublicPropertySetupStatus;
    }[]> {
        // Busca específica pelo userId fornecido
        const addresses = await this.addressRepository.find({
            where: { user: { id: userId }, ativo: true, list: { ativo: true } },
            relations: ['list'],
            select: ['id', 'cep', 'numero', 'logradouro', 'bairro', 'cidade', 'estado', 'analisado', 'latitude', 'longitude']
        });

        return addresses.map(address => ({
            latitude: address?.latitude,
            longitude: address?.longitude,
            id: address.id,
            propertyName: address.list?.titulo || `Propriedade sem nome (${address.id.substring(0, 4)})`,
            image_url: address.list?.pictureUrl,
            userId: userId,
            analisado: address?.analisado,
            id_do_anuncio: address.list?.id_do_anuncio,
            internalNickname: address.list?.internalNickname ?? null,
            internalCode: address.list?.internalCode ?? null,
            manualDailyPrice: address.list?.manualDailyPrice ?? null,
            averageMonthlyRevenue: address.list?.averageMonthlyRevenue ?? null,
            dailyPrice: address.list?.dailyPrice ?? null,
            pricingInputSource: address.list?.pricingInputSource ?? null,
            pricingInputsUpdatedAt: address.list?.pricingInputsUpdatedAt ?? null,
            cep: address.cep ?? null,
            numero: address.numero ?? null,
            logradouro: address.logradouro ?? null,
            bairro: address.bairro ?? address.list?.neighborhood ?? null,
            cidade: address.cidade ?? null,
            estado: address.estado ?? null,
            addressLine: this.formatAddressLine(address),
            locationLabel: this.formatLocationLabel(address),
            setupStatus: this.buildPublicPropertySetupStatus(address),
        }));

    }

    private buildPublicPropertySetupStatus(address: Address): PublicPropertySetupStatus {
        return buildPublicPropertySetupStatus(address);
    }

    private hasUsableCoordinates(address: Address): boolean {
        return hasUsableCoordinates(address);
    }

    async updateIdentity(
        addressId: string,
        userId: string,
        input: { internalNickname?: string | null; internalCode?: string | null },
    ) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        address.list.internalNickname = this.normalizeOptionalText(input.internalNickname, 'internalNickname', 80);
        address.list.internalCode = this.normalizeOptionalText(input.internalCode, 'internalCode', 32);

        const saved = await this.propriedades.save(address.list);

        return {
            addressId,
            listId: saved.id,
            internalNickname: saved.internalNickname ?? null,
            internalCode: saved.internalCode ?? null,
        };
    }

    async updatePricingInputs(
        addressId: string,
        userId: string,
        input: { manualDailyPrice?: number | null; averageMonthlyRevenue?: number | null },
    ) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        const manualDailyPrice = this.normalizeOptionalMoney(input.manualDailyPrice, 'manualDailyPrice');
        const averageMonthlyRevenue = this.normalizeOptionalMoney(input.averageMonthlyRevenue, 'averageMonthlyRevenue');
        const previousManualDailyPrice = address.list.manualDailyPrice ?? null;
        const previousAverageMonthlyRevenue = address.list.averageMonthlyRevenue ?? null;

        address.list.manualDailyPrice = manualDailyPrice;
        address.list.averageMonthlyRevenue = averageMonthlyRevenue;
        address.list.pricingInputSource = manualDailyPrice ? 'manual' : null;
        address.list.pricingInputsUpdatedAt = new Date();
        if (manualDailyPrice) address.list.hostInputUpdatedAt = address.list.pricingInputsUpdatedAt;

        if (manualDailyPrice) {
            address.list.dailyPrice = manualDailyPrice;
            address.list.raw = manualDailyPrice;
            address.list.currency = 'BRL';
            address.list.priceText = `R$${manualDailyPrice.toFixed(2)}`;
        }

        const saved = await this.propriedades.save(address.list);
        await this.recordPricingInputHistory({
            address,
            list: saved,
            userId,
            previousManualDailyPrice,
            newManualDailyPrice: saved.manualDailyPrice ?? null,
            previousAverageMonthlyRevenue,
            newAverageMonthlyRevenue: saved.averageMonthlyRevenue ?? null,
        });

        return {
            addressId,
            listId: saved.id,
            manualDailyPrice: saved.manualDailyPrice ?? null,
            averageMonthlyRevenue: saved.averageMonthlyRevenue ?? null,
            dailyPrice: saved.dailyPrice ?? null,
            pricingInputSource: saved.pricingInputSource ?? null,
            pricingInputsUpdatedAt: saved.pricingInputsUpdatedAt ?? null,
        };
    }

    async getPricingInputHistory(addressId: string, userId: string, limit = 20) {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
        return this.pricingInputHistoryRepository.find({
            where: { list: { id: address.list.id }, user: { id: userId } },
            order: { createdAt: 'DESC' },
            take: safeLimit,
        });
    }

    async getOccupancyHistory(
        addressId: string,
        userId: string,
        input?: { from?: string; to?: string; limit?: number },
    ) {
        const address = await this.findOwnedAddressWithList(addressId, userId);
        const today = new Date();
        const defaultFrom = this.dateOnly(addDays(today, -30));
        const defaultTo = this.dateOnly(addDays(today, 60));
        const from = this.normalizeDateOnly(input?.from, 'from') ?? defaultFrom;
        const to = this.normalizeDateOnly(input?.to, 'to') ?? defaultTo;
        const safeLimit = Math.min(Math.max(Number(input?.limit) || 120, 1), 240);

        const records = await this.occupancyHistoryRepository.find({
            where: {
                user: { id: userId },
                list: { id: address.list.id },
                date: Between(from, to),
            },
            order: { date: 'DESC' },
            take: safeLimit,
        });

        return records.map((record) => this.toPublicOccupancyRecord(record));
    }

    async upsertManualOccupancy(
        addressId: string,
        userId: string,
        input: {
            date?: string;
            status?: 'booked' | 'available' | 'blocked' | 'unknown';
            revenue?: number | null;
            listedPrice?: number | null;
            nightsBooked?: number | null;
        },
    ) {
        const address = await this.findOwnedAddressWithList(addressId, userId);
        const date = this.normalizeDateOnly(input?.date, 'date');
        if (!date) {
            throw new HttpException('date e obrigatorio no formato YYYY-MM-DD', HttpStatus.BAD_REQUEST);
        }

        const status = this.normalizeOccupancyStatus(input?.status);
        const revenue = this.normalizeOptionalMoney(input?.revenue, 'revenue');
        const listedPrice = this.normalizeOptionalMoney(input?.listedPrice, 'listedPrice');
        const nightsBooked = this.normalizeOptionalInteger(input?.nightsBooked, 'nightsBooked');

        const existing = await this.occupancyHistoryRepository.findOne({
            where: { list: { id: address.list.id }, date },
        });
        const record = existing ?? this.occupancyHistoryRepository.create();

        record.date = date;
        record.list = address.list;
        record.address = address;
        record.user = { id: userId } as User;
        record.status = status;
        record.revenueCents = revenue == null ? null : Math.round(revenue * 100);
        record.listedPriceCents = listedPrice == null ? null : Math.round(listedPrice * 100);
        record.currency = 'BRL';
        record.origin = 'manual';
        record.externalReservationId = null;
        record.nightsBooked = status === 'booked' ? nightsBooked ?? 1 : nightsBooked;
        record.trainingReady = status === 'booked' || status === 'available';

        const saved = await this.occupancyHistoryRepository.save(record);
        return this.toPublicOccupancyRecord(saved);
    }

    private async recordPricingInputHistory(input: {
        address: Address;
        list: List;
        userId: string;
        previousManualDailyPrice: number | null;
        newManualDailyPrice: number | null;
        previousAverageMonthlyRevenue: number | null;
        newAverageMonthlyRevenue: number | null;
    }): Promise<void> {
        const changed =
            !this.sameMoney(input.previousManualDailyPrice, input.newManualDailyPrice) ||
            !this.sameMoney(input.previousAverageMonthlyRevenue, input.newAverageMonthlyRevenue);

        if (!changed) return;

        await this.pricingInputHistoryRepository.save(
            this.pricingInputHistoryRepository.create({
                address: input.address,
                list: input.list,
                user: { id: input.userId } as User,
                previousManualDailyPrice: input.previousManualDailyPrice,
                newManualDailyPrice: input.newManualDailyPrice,
                previousAverageMonthlyRevenue: input.previousAverageMonthlyRevenue,
                newAverageMonthlyRevenue: input.newAverageMonthlyRevenue,
                source: 'manual',
                changedByUserId: input.userId,
            }),
        );
    }

    private sameMoney(a: number | null, b: number | null): boolean {
        return sameMoney(a, b);
    }

    private async findOwnedAddressWithList(addressId: string, userId: string): Promise<Address & { list: List }> {
        const address = await this.addressRepository.findOne({
            where: { id: addressId, user: { id: userId } },
            relations: ['list'],
        });

        if (!address?.list) {
            throw new NotFoundException('Propriedade não encontrada');
        }

        return address as Address & { list: List };
    }

    private normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null {
        return normalizeOptionalText(value, field, maxLength);
    }

    private normalizeOptionalMoney(value: unknown, field: string): number | null {
        return normalizeOptionalMoney(value, field);
    }

    private normalizeOptionalInteger(value: unknown, field: string): number | null {
        return normalizeOptionalInteger(value, field);
    }

    private normalizeDateOnly(value: unknown, field: string): string | null {
        return normalizeDateOnly(value, field);
    }

    private normalizeOccupancyStatus(value: unknown): 'booked' | 'available' | 'blocked' | 'unknown' {
        return normalizeOccupancyStatus(value);
    }

    private toPublicOccupancyRecord(record: OccupancyHistory) {
        return toPublicOccupancyRecord(record);
    }

    private dateOnly(value: Date): string {
        return dateOnly(value);
    }

    private formatAddressLine(address: Address): string | null {
        return formatAddressLine(address);
    }

    private formatLocationLabel(address: Address): string | null {
        return formatLocationLabel(address);
    }

    private toPublicAddress(address: Address): PublicAddressResponse {
        return toPublicAddress(address);
    }

    private toPublicList(list: List): PublicListResponse {
        return toPublicList(list);
    }
}
