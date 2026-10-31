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
import { KnnEngineModule } from '../knn-engine/knn-engine.module';
import { AuthModule } from 'src/auth/auth.module';
import { PricingInputHistory } from 'src/entities/pricing-input-history.entity';
import { PricingGuardrailService } from './pricing-guardrail.service';
import { MailerModule } from 'src/mailer/mailer.module';
import { OccupancyHistory } from 'src/entities/occupancy-history.entity';
import { PricingRuleConfig } from 'src/entities/pricing-rule-config.entity';
import { HostBaselineService } from './host-baseline.service';
import { AirbnbListingMetadataService } from './airbnb-listing-metadata.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { PropertyEventAnalysesService } from './property-event-analyses.service';
import { PropertyListingQuoteService } from './property-listing-quote.service';
import { PropertyPortfolioService } from './property-portfolio.service';
import { PropertyPricingAnalysisService } from './property-pricing-analysis.service';
import { PropertyScrapingService } from './property-scraping.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Address,
            Event,
            List,
            AnaliseEnderecoEvento,
            AnalisePreco,
            User,
            PricingInputHistory,
            OccupancyHistory,
            PricingRuleConfig,
        ]),
        forwardRef(() => AirbnbModule),
        EmailModule,
        MailerModule,
        AuthModule,
        // F6.1 — motor de pricing (engine + strategies + bootstrap)
        KnnEngineModule,
        // Insumo de mercado por bairro para o v2 em sombra (ADR 0028)
        MarketDataModule,
    ],
    controllers: [PropriedadeController],
    providers: [
        PropriedadeService,
        PropertyPortfolioService,
        PropertyScrapingService,
        PropertyListingQuoteService,
        PropertyPricingAnalysisService,
        PropertyEventAnalysesService,
        PricingCalculateService,
        PricingGuardrailService,
        AirbnbListingMetadataService,
        HostBaselineService,
    ],
    exports: [PropriedadeService],
})
export class PropriedadeModule { }
