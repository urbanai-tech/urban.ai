import { PropriedadeModule } from 'src/propriedades/propriedade.module';
import { AirbnbController } from './airbnb.controller';
import { AirbnbService } from './airbnb.service';
import { forwardRef, Module } from '@nestjs/common';

@Module({
    imports:  [forwardRef(() => PropriedadeModule)],
    controllers: [
        AirbnbController,],
    providers: [
        AirbnbService,],
        exports: [AirbnbService],
})
export class AirbnbModule { }
