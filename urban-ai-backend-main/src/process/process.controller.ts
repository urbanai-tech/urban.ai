import { Controller, Get, Put, Body, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProcessState, ProcessStatus } from 'src/entities/processStatus.entity';
import { ProcessService } from './process.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';

class UpdateStatusDto {
    @IsEnum(['running', 'completed', 'error'])
    status: ProcessState;

    @IsOptional()
    @IsString()
    errorMessage?: string;
}

@ApiTags('Process Status')
@Controller('process-status')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ProcessController {
    constructor(private readonly processStatusService: ProcessService) { }

    @Get()
    @ApiOperation({ summary: 'Obter status atual do processo' })
    @ApiResponse({ status: 200, description: 'Status atual retornado com sucesso.' })
    @ApiResponse({ status: 404, description: 'Status não encontrado.' })
    async getStatus(): Promise<ProcessStatus> {
        const status = await this.processStatusService.getCurrentStatus();
        if (!status) throw new NotFoundException('Status não encontrado');
        return status;
    }

    @Put()
    @ApiOperation({ summary: 'Atualizar o status do processo' })
    @ApiResponse({ status: 200, description: 'Status atualizado com sucesso.' })
    @ApiResponse({ status: 404, description: 'Status não encontrado para atualizar.' })
    async updateStatus(@Body() body: UpdateStatusDto): Promise<ProcessStatus> {
        const updated = await this.processStatusService.updateStatus(body.status, body.errorMessage);
        if (!updated) throw new NotFoundException('Status não encontrado para atualizar');
        return updated;
    }
}
