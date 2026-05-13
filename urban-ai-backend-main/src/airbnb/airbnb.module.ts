import { PropriedadeModule } from 'src/propriedades/propriedade.module';
import { AirbnbController } from './airbnb.controller';
import { AirbnbService } from './airbnb.service';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports:  [forwardRef(() => PropriedadeModule), AuthModule],
    controllers: [
        AirbnbController,],
    providers: [
        AirbnbService,],
        exports: [AirbnbService],
})
export class AirbnbModule { }
