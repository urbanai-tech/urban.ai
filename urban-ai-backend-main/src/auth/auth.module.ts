import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { LocalAuthGuard } from './local-auth.guard';
import { User } from 'src/entities/user.entity';
import { PaymentsModule } from 'src/payments/payments.module';

@Module({
  imports: [
    PaymentsModule,
    PassportModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: 'mysecretkey',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
