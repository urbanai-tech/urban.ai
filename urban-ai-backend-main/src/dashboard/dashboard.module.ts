import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Module } from '@nestjs/common';
import { Address } from 'src/entities/addresses.entity';
import { Event } from 'src/entities/events.entity';
import { List } from 'src/entities/list.entity';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { User } from 'src/entities/user.entity';
import { PropriedadeModule } from 'src/propriedades/propriedade.module';

@Module({
    imports: [TypeOrmModule.forFeature([
        Address,
        Event,
        List,
        AnaliseEnderecoEvento,
        AnalisePreco,
        User
    ]), PropriedadeModule],
    controllers: [
        DashboardController,],
    providers: [
        DashboardService,],
})
export class DashboardModule { }
