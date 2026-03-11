import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/entities/user.entity';
import { Address } from 'src/entities/addresses.entity';
import { FindOptionsWhere, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private jwtService: JwtService,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    // ✅ Injeta o repositório de Address
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
  ) {}

  async register(data: { username: string; email: string; password: string }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.userRepository.create({ ...data, password: hashedPassword });
    return this.userRepository.save(user);
  }

  async userHasAnyAddress(
    userId: string,
    onlyActive = true,
  ): Promise<{ hasAddress: boolean; count: number }> {
    if (!userId) {
      throw new UnauthorizedException('Token inválido: userId ausente');
    }

    const where: FindOptionsWhere<Address> = {
      user: { id: userId },
      ...(onlyActive ? { ativo: true } : {}),
    } as any;

    const [hasAddress, count] = await Promise.all([
      this.addressRepo.exist({ where }),
      this.addressRepo.count({ where }),
    ]);

    return { hasAddress, count };
  }
}
