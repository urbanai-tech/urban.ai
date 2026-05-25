import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/** Nome do cookie que guarda o access token httpOnly. */
export const ACCESS_TOKEN_COOKIE = 'urbanai_access_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      // Aceita token tanto via Authorization Bearer (cliente legado com
      // localStorage) quanto via cookie httpOnly (novo caminho, mais seguro).
      // Ordem: cookie primeiro; header como fallback retrocompat.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[ACCESS_TOKEN_COOKIE] || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: secret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'username', 'role', 'ativo'],
    });

    if (!user || !user.ativo) {
      throw new UnauthorizedException('Usuário inativo ou inexistente.');
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      profile: payload.profile,
    };
  }
}
