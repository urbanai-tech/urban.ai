import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessController } from './process.controller';
import { ProcessService } from './process.service';
import { Module } from '@nestjs/common';
import { ProcessStatus } from 'src/entities/processStatus.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([
        ProcessStatus
    ]), AuthModule],
    controllers: [
        ProcessController,],
    providers: [
        ProcessService,],
        exports:[ProcessService]
})
export class ProcessModule { }
