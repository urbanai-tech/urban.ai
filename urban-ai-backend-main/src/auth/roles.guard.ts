import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ROLES_KEY } from './roles.decorator';

/**
 * Guard que valida o `User.role` contra a lista declarada em `@Roles(...)`.
 *
 * Desenhado para coexistir com o `JwtAuthGuard`: assume que `req.user.userId`
 * já foi populado por uma estratégia de autenticação anterior. Faz uma query
 * para buscar o role atual no DB (sem confiar no claim do JWT — assim a
 * remoção de privilégio tem efeito imediato sem esperar token expirar).
 *
 * Recomendado uso:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Roles() → libera (a auth padrão já cuidou de autenticar).
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request?.user?.userId;
    if (!userId) {
      throw new ForbiddenException('Acesso negado: usuário não autenticado.');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'role', 'ativo'],
    });

    if (!user || !user.ativo) {
      throw new ForbiddenException('Acesso negado: usuário inválido.');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Acesso negado: role '${user.role}' não tem permissão (requer: ${requiredRoles.join(' | ')}).`,
      );
    }

    return true;
  }
}
