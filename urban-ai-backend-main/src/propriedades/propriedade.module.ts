import { PropriedadeService } from './propriedade.service';
import { PropriedadeController } from './propriedade.controller';

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/addresses.entity';
import { List } from 'src/entities/list.entity';
import { PricingCalculateService } from './pricing-calculate.service';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { Event } from 'src/entities/events.entity';
import { AirbnbModule } from 'src/airbnb/airbnb.module';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { User } from 'src/entities/user.entity';
import { EmailModule } from 'src/email/email.module';

@Module({
    imports: [TypeOrmModule.forFeature([
        Address,
        Event,
        List,
        AnaliseEnderecoEvento,
        AnalisePreco,
        User
    ]), forwardRef(() => AirbnbModule), EmailModule],
    controllers: [
        PropriedadeController,],
    providers: [
        PropriedadeService, PricingCalculateService],
        exports:[PropriedadeService]
})
export class PropriedadeModule { }
