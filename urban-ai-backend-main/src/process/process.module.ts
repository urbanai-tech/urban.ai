import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessController } from './process.controller';
import { ProcessService } from './process.service';
import { Module } from '@nestjs/common';
import { ProcessStatus } from 'src/entities/processStatus.entity';

@Module({
    imports: [TypeOrmModule.forFeature([
        ProcessStatus
    ]),],
    controllers: [
        ProcessController,],
    providers: [
        ProcessService,],
        exports:[ProcessService]
})
export class ProcessModule { }
