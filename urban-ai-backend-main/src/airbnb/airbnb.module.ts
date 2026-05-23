import { PropriedadeModule } from 'src/propriedades/propriedade.module';
import { AirbnbController } from './airbnb.controller';
import { AirbnbService } from './airbnb.service';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AirbnbBrowserScraperService } from './airbnb-browser-scraper.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirbnbPricingAttemptLog } from 'src/entities/airbnb-pricing-attempt-log.entity';

@Module({
    imports:  [
        forwardRef(() => PropriedadeModule),
        AuthModule,
        TypeOrmModule.forFeature([AirbnbPricingAttemptLog]),
    ],
    controllers: [
        AirbnbController,],
    providers: [
        AirbnbService,
        AirbnbBrowserScraperService,],
        exports: [AirbnbService, AirbnbBrowserScraperService],
})
export class AirbnbModule { }
