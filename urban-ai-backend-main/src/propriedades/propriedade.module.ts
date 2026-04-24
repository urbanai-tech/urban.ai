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
import { UrbanAIPricingEngine } from '../knn-engine/pricing-engine';
import { TravelTimeEngine } from '../knn-engine/isochrone';
import { PropertyClassifier } from '../knn-engine/knn-classifier';
import { DisplacementCostMatrix } from '../knn-engine/cost-matrix';

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
        PropriedadeService,
        PricingCalculateService,
        // Motor KNN injetado via DI — habilita mock em testes unitários
        // e centraliza a decisão de "1 engine por request" vs singleton.
        TravelTimeEngine,
        PropertyClassifier,
        DisplacementCostMatrix,
        UrbanAIPricingEngine,
    ],
        exports:[PropriedadeService]
})
export class PropriedadeModule { }
