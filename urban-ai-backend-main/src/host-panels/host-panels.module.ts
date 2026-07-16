import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { AskUrbanMessage } from '../entities/ask-urban-message.entity';
import { Event } from '../entities/events.entity';
import { List } from '../entities/list.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { PortfolioActionItem } from '../entities/portfolio-action-item.entity';
import { PortfolioActionRun } from '../entities/portfolio-action-run.entity';
import { PortfolioDailyPriceOverride } from '../entities/portfolio-daily-price-override.entity';
import { PortfolioPropertySetting } from '../entities/portfolio-property-setting.entity';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { PricingRuleConfig } from '../entities/pricing-rule-config.entity';
import { User } from '../entities/user.entity';
import { EventIntelligenceModule } from '../event-intelligence/event-intelligence.module';
import { AskController } from './ask.controller';
import { HostEventsController } from './host-events.controller';
import { HostPanelsService } from './host-panels.service';
import { PaceController } from './pace.controller';
import { PortfolioController } from './portfolio.controller';
import { PropertiesPanelController } from './properties-panel.controller';
import { PortfolioActionTargetResolverService } from './portfolio-action-target-resolver.service';

@Module({
  imports: [
    EventIntelligenceModule,
    TypeOrmModule.forFeature([
      Address,
      AnalisePreco,
      AskUrbanMessage,
      Event,
      List,
      OccupancyHistory,
      PortfolioActionItem,
      PortfolioActionRun,
      PortfolioDailyPriceOverride,
      PortfolioPropertySetting,
      PriceSnapshot,
      PricingRuleConfig,
      User,
    ]),
  ],
  controllers: [
    AskController,
    HostEventsController,
    PaceController,
    PortfolioController,
    PropertiesPanelController,
  ],
  providers: [PortfolioActionTargetResolverService, HostPanelsService],
})
export class HostPanelsModule {}
