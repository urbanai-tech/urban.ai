import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity'; // ✅ importe a entidade Address

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Address]), // ✅ inclua Address aqui
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
