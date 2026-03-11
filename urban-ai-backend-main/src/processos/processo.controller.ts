// src/processo/processo.controller.ts
import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Body, Controller, Post, Logger, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Queue } from 'bull';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/connect/connect.controller';
import { PropertyDto } from 'src/maps/maps.controller';

export class CreatePricingJobDto {
    @ApiProperty({
        description: 'ID da lista/propriedade que será processada para cálculo de pricing',
        example: 'df6a7b8c-9d0e-1234-f012-567890ab3456',
    })
    listId: string;
}

export class CreateAcaoDto {
    @ApiProperty({
        description: 'ID do usuário que será processado',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    userId: string;
    listIds: PropertyDto[]
}


@ApiTags('processos')
@Controller('processos')
export class ProcessoController {

    private readonly logger = new Logger(ProcessoController.name);

    constructor(@InjectQueue('processos') private readonly queue: Queue) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    @ApiOperation({ summary: 'Cria/Enfileira um job de processo para um usuário' })

    @ApiBody({
        description: 'Dados do usuário e lista de propriedades a serem processadas',
        type: CreateAcaoDto,
        examples: {
            exemplo: {
                summary: 'Exemplo de requisição',
                value: {
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    listIds: [
                        { id: 'ff126501-301a-4af6-b235-1e78a88095ae' },
                        { id: 'aa126501-301a-4af6-b235-1e78a88095ae' }
                    ]
                }
            }
        }
    })
    @ApiResponse({
        status: 201,
        description: 'Job enfileirado com sucesso',
        schema: {
            example: { status: 'job enfileirado', userId: '123e4567-e89b-12d3-a456-426614174000' },
        },
    })
    @ApiResponse({ status: 400, description: 'Request inválido' })
    async criarAcao(@Body() body: CreateAcaoDto, @Req() req: AuthenticatedRequest) {

        const userId = req.user.userId;

        console.log("🛠️  Iniciando criarAcao");
        console.log("📦 Headers recebidos:", req.headers);
        console.log("🔑 Authorization:", req.headers.authorization);
        console.log("👤 Usuário autenticado:", req.user);

        if (!userId) {
            throw new UnauthorizedException(
                "🚫 Usuário não autenticado ou ID não fornecido",
            );
        }

        if (!body?.listIds || !Array.isArray(body.listIds)) {
            throw new BadRequestException(
                "🚫 Nenhuma lista de IDs foi fornecida ou formato inválido",
            );
        }

        const idsArray = body?.listIds.map(item => item.id);
        console.log(`📌 Total de propriedades a processar: ${idsArray.length}`);

        let count = 0;
        for (const propertyId of idsArray) {
            console.log(`\n🏁 Iniciando propriedade ${count + 1}/${idsArray.length}: ${propertyId}`);

            try {
                const propertyAdressId = propertyId; // listId
                this.logger.log(`🚀 Adicionando job para propriedade ${propertyAdressId} do usuário ${userId}`);

                await this.queue.add(
                    { userId: userId, propertyAdressId },
                    {
                        jobId: `processo-${propertyAdressId}`, // evita duplicar job para o mesmo user
                        removeOnComplete: true,
                        removeOnFail: false,
                    },
                );

                console.log(`✅ Job enfileirado com sucesso para propriedade ${propertyAdressId}`);
                count++;

            } catch (error) {
                this.logger.error(`❌ Erro ao processar a propriedade ${propertyId} do usuário ${userId}`, error.stack);
            }

            console.log(`📍 Propriedade ${count}/${idsArray.length} finalizada`);
        }

        console.log(`\n🎯 Todos os jobs processados. Total enfileirados: ${count}`);
        return { status: 'job enfileirado', userId: userId };
    }

    @Post('pricing')
    @ApiOperation({ summary: 'Cria/Enfileira um job de pricing para uma lista/propriedade' })
    @ApiResponse({
        status: 201,
        description: 'Job enfileirado com sucesso',
        schema: {
            example: {
                status: 'job enfileirado',
                listId: 'df6a7b8c-9d0e-1234-f012-567890ab3456',
            },
        },
    })
    @ApiResponse({ status: 400, description: 'ID não fornecido' })
    async criarProcessoLista(@Body() body: CreatePricingJobDto) {
        if (!body?.listId) {
            throw new BadRequestException('ID não fornecido');
        }

        await this.queue.add(
            'processar-pricing',
            { listId: body.listId },
            {
                jobId: `processar-pricing-${body.listId}`,
                removeOnComplete: true,
                removeOnFail: false,
            },
        );

        return { status: 'job enfileirado', listId: body.listId };
    }
}
