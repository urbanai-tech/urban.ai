import { InjectQueue } from '@nestjs/bull';
import {
    BadRequestException,
    Body,
    Controller,
    Logger,
    NotFoundException,
    Post,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bull';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { AuthenticatedRequest } from 'src/connect/connect.controller';
import { Address } from 'src/entities/addresses.entity';
import { MapsService } from 'src/maps/maps.service';
import { PropertyDto } from 'src/maps/maps.controller';
import { DataSource } from 'typeorm';

export class CreatePricingJobDto {
    @ApiProperty({
        description: 'ID do usuario dono da propriedade/endereco',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    userId: string;

    @ApiProperty({
        description: 'ID da propriedade/endereco que sera processada para calculo de pricing',
        example: 'df6a7b8c-9d0e-1234-f012-567890ab3456',
    })
    propertyAdressId: string;
}

export class CreateAcaoDto {
    @ApiProperty({
        description: 'ID do usuario que sera processado',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    userId: string;

    listIds: PropertyDto[];
}

@ApiTags('processos')
@Controller('processos')
export class ProcessoController {
    private readonly logger = new Logger(ProcessoController.name);

    constructor(
        @InjectQueue('processos') private readonly queue: Queue,
        private readonly dataSource: DataSource,
        private readonly mapsService: MapsService,
    ) {}

    private hasValidBasePrice(list: any): boolean {
        const manualDailyPrice = Number(list?.manualDailyPrice);
        const dailyPrice = Number(list?.dailyPrice);
        return (
            (Number.isFinite(manualDailyPrice) && manualDailyPrice > 0) ||
            (Number.isFinite(dailyPrice) && dailyPrice > 0)
        );
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    @ApiOperation({ summary: 'Enfileira jobs de processo para o usuario autenticado' })
    @ApiBody({
        description: 'Lista de propriedades a serem processadas',
        type: CreateAcaoDto,
    })
    @ApiResponse({
        status: 201,
        description: 'Jobs enfileirados com sucesso',
        schema: {
            example: { status: 'jobs enfileirados', userId: '123e4567-e89b-12d3-a456-426614174000' },
        },
    })
    @ApiResponse({ status: 400, description: 'Request invalido' })
    async criarAcao(@Body() body: CreateAcaoDto, @Req() req: AuthenticatedRequest) {
        const userId = req.user.userId;

        if (!userId) {
            throw new UnauthorizedException('Usuario nao autenticado ou ID nao fornecido');
        }

        if (!body?.listIds || !Array.isArray(body.listIds)) {
            throw new BadRequestException('Nenhuma lista de IDs foi fornecida ou formato invalido');
        }

        const idsArray = [...new Set(body.listIds.map((item) => item.id).filter(Boolean))];
        if (idsArray.length === 0) {
            throw new BadRequestException('Nenhum ID de propriedade valido foi fornecido');
        }

        const ownedAddresses = await this.dataSource
            .getRepository(Address)
            .createQueryBuilder('address')
            .leftJoinAndSelect('address.list', 'list')
            .where('address.user_id = :userId', { userId })
            .andWhere('address.list_id IN (:...ids)', { ids: idsArray })
            .getMany();
        const ownedIds = new Set(ownedAddresses.map((address) => address.list?.id).filter(Boolean));
        const pricedIds = new Set(
            ownedAddresses
                .filter((address) => this.hasValidBasePrice(address.list))
                .map((address) => address.list?.id)
                .filter(Boolean),
        );
        const missingBasePriceIds = idsArray.filter((id) => ownedIds.has(id) && !pricedIds.has(id));

        if (missingBasePriceIds.length > 0) {
            throw new BadRequestException({
                message: 'Informe manualDailyPrice ou dailyPrice antes de iniciar a analise de pricing.',
                propriedadesSemPrecoBase: missingBasePriceIds,
            });
        }

        this.logger.log(`Total de propriedades a enfileirar: ${idsArray.length}`);

        let count = 0;
        let skipped = 0;
        let unauthorized = 0;
        for (const propertyAdressId of idsArray) {
            try {
                if (!ownedIds.has(propertyAdressId)) {
                    unauthorized++;
                    this.logger.warn(`Propriedade ${propertyAdressId} ignorada: nao pertence ao usuario ${userId}`);
                    continue;
                }

                try {
                    const jobId = `processo-${userId}-${propertyAdressId}`;
                    const existingJob = await this.queue.getJob(jobId);
                    if (existingJob) {
                        const state = await existingJob.getState();
                        if (['waiting', 'active', 'delayed', 'paused'].includes(state)) {
                            skipped++;
                            this.logger.warn(`Job ja existe (${state}) para propriedade ${propertyAdressId}`);
                            continue;
                        }
                        if (state === 'failed' || state === 'completed') {
                            await existingJob.remove();
                        }
                    }

                    this.logger.log(`Adicionando job para propriedade ${propertyAdressId} do usuario ${userId}`);

                    await this.queue.add(
                        { userId, propertyAdressId },
                        {
                            jobId,
                            removeOnComplete: true,
                            removeOnFail: false,
                        },
                    );
                } catch (queueError) {
                    this.logger.warn(
                        `Fila indisponivel; processando propriedade ${propertyAdressId} inline para nao bloquear o usuario`,
                    );
                    this.logger.error(queueError instanceof Error ? queueError.stack : String(queueError));
                    await this.mapsService.processarAnalisesByProperty(userId, propertyAdressId);
                }

                count++;
            } catch (error) {
                this.logger.error(
                    `Erro ao enfileirar propriedade ${propertyAdressId} do usuario ${userId}`,
                    error instanceof Error ? error.stack : String(error),
                );
            }
        }

        this.logger.log(
            `Jobs enfileirados: ${count}/${idsArray.length}; duplicados ignorados: ${skipped}; sem ownership: ${unauthorized}`,
        );
        return {
            status: 'jobs enfileirados',
            userId,
            totalEnfileirados: count,
            duplicadosIgnorados: skipped,
            propriedadesIgnoradas: unauthorized,
        };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @Post('pricing')
    @ApiOperation({ summary: 'Enfileira job admin de pricing para uma propriedade' })
    @ApiResponse({
        status: 201,
        description: 'Job enfileirado com sucesso',
    })
    @ApiResponse({ status: 400, description: 'ID nao fornecido' })
    async criarProcessoLista(@Body() body: CreatePricingJobDto) {
        if (!body?.userId || !body?.propertyAdressId) {
            throw new BadRequestException('ID nao fornecido');
        }

        const ownedAddress = await this.dataSource
            .getRepository(Address)
            .createQueryBuilder('address')
            .leftJoinAndSelect('address.list', 'list')
            .where('address.user_id = :userId', { userId: body.userId })
            .andWhere('address.list_id = :propertyAdressId', { propertyAdressId: body.propertyAdressId })
            .getOne();

        if (!ownedAddress) {
            throw new NotFoundException('Propriedade nao encontrada para o usuario informado');
        }

        if (!this.hasValidBasePrice(ownedAddress.list)) {
            throw new BadRequestException(
                'Informe manualDailyPrice ou dailyPrice antes de iniciar a analise de pricing.',
            );
        }

        const jobId = `processar-pricing-${body.userId}-${body.propertyAdressId}`;
        const existingJob = await this.queue.getJob(jobId);
        if (existingJob) {
            const state = await existingJob.getState();
            if (['waiting', 'active', 'delayed', 'paused'].includes(state)) {
                return {
                    status: 'job ja existente',
                    state,
                    userId: body.userId,
                    propertyAdressId: body.propertyAdressId,
                };
            }
            if (state === 'failed' || state === 'completed') {
                await existingJob.remove();
            }
        }

        await this.queue.add(
            'processar-pricing',
            { userId: body.userId, propertyAdressId: body.propertyAdressId },
            {
                jobId,
                removeOnComplete: true,
                removeOnFail: false,
            },
        );

        return {
            status: 'job enfileirado',
            userId: body.userId,
            propertyAdressId: body.propertyAdressId,
        };
    }
}
