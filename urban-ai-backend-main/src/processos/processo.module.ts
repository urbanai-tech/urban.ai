import { ProcessoService } from './processo.service';
import { Module } from '@nestjs/common';
import { ProcessosConsumer } from './processos.processor';
import { MapsModule } from 'src/maps/maps.module';

@Module({
    imports: [MapsModule],
    controllers: [],
    providers: [
        ProcessoService, ProcessosConsumer],
})
export class ProcessoModule { }
