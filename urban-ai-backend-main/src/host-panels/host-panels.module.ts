import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { AskUrbanMessage } from '../entities/ask-urban-message.entity';
import { Event } from '../entities/events.entity';
import { List } from '../entities/list.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { PricingRuleConfig } from '../entities/pricing-rule-config.entity';
import { User } from '../entities/user.entity';
import { AskController } from './ask.controller';
import { HostPanelsService } from './host-panels.service';
import { PaceController } from './pace.controller';
import { PortfolioController } from './portfolio.controller';
import { PropertiesPanelController } from './properties-panel.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Address,
      AnalisePreco,
      AskUrbanMessage,
      Event,
      List,
      OccupancyHistory,
      PriceSnapshot,
      PricingRuleConfig,
      User,
    ]),
  ],
  controllers: [
    AskController,
    PaceController,
    PortfolioController,
    PropertiesPanelController,
  ],
  providers: [HostPanelsService],
})
export class HostPanelsModule {}
