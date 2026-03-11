import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from 'src/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { PaymentsService } from 'src/payments/payments.service';
import { DataSource } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private userRepository: Repository<User>,
    private readonly paymentsService: PaymentsService
  ) { }

  private isLegacyHash(hash: string): boolean {
    return hash.startsWith('$2a$') || hash.startsWith('$2b$');
  }

  /** SHA-256 simples sem salt */
  private sha256(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  // Helper para identificar senhas legadas
  private isLegacyPasswordHash(password: string): boolean {
    return password.startsWith('$2a$') || password.startsWith('$2b$');
  }

  // Helper para criar hash no formato frontend
  private hashFrontendPassword(password: string): string {
    // Use um salt fixo (pode ser armazenado em variável de ambiente)
    const salt = process.env.FRONTEND_PASSWORD_SALT || 'default-static-salt';
    return crypto.createHash('sha256').update(salt + password).digest('hex');
  }

  // === NOVO: remover password do retorno ===
  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...safe } = user as User & { password?: string };
    return safe;
  }

  async register(data: { username: string; email: string; password: string }) {
    const isHex = /^[a-f0-9]{64}$/i.test(data.password);
    const pwdHash = isHex ? data.password : this.sha256(data.password);
    console.log(data.password, pwdHash)
    const user = this.userRepository.create({ ...data, password: pwdHash });
    const savedUser = await this.userRepository.save(user);
    await this.paymentsService.createPayment(savedUser);

    return savedUser;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.userRepository.remove(user);
  }

  async findUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile']
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async update(userId: string, data: {
    username?: string;
    email?: string;
    password?: string;
  }): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile']
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (data.username) user.username = data.username;
    if (data.email) user.email = data.email;

    if (data.password) {
      // Verifica se é um hash frontend
      const isFrontendHash = /^[a-f0-9]{64}$/i.test(data.password);

      if (isFrontendHash) {
        user.password = data.password;
      } else {
        user.password = await bcrypt.hash(data.password, 10);
      }
    }

    return this.userRepository.save(user);
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const inputHash = /^[a-f0-9]{64}$/i.test(password)
      ? password
      : this.sha256(password);

    if (user.password !== inputHash) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return { accessToken: this.jwtService.sign({ sub: user.id, username: user.username }) };
  }

  async googleLogin(userData: {
    token?: string,
    email: string,
    name: string,
    picture?: string
  }) {
    try {
      // Verificar se o usuário já existe
      let user = await this.userRepository.findOne({
        where: { email: userData.email }
      });

      if (!user) {
        // Se o usuário não existir, crie-o com formato especial para Google
        const randomUUID = uuidv4();
        const googlePassword = `google_${randomUUID}`;

        user = this.userRepository.create({
          username: userData.name,
          email: userData.email,
          password: googlePassword,
        });

        user = await this.userRepository.save(user);
        await this.paymentsService.createPayment(user);

      } else {
        // Se o usuário existe mas não é conta Google, converte
        if (!user.password.startsWith('google_')) {
          const randomUUID = uuidv4();
          user.password = `google_${randomUUID}`;
          user = await this.userRepository.save(user);
          await this.paymentsService.createPayment(user);
        }
      }

      // Gerar token JWT
      const payload = { sub: user.id, username: user.username };
      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      };
    } catch (error) {
      console.error('Erro no login com Google:', error);
      throw new InternalServerErrorException('Falha no login com Google');
    }
  }

  // === NOVOS MÉTODOS PARA PERFIL POR ID (sem alterar os existentes) ===

  /**
   * Retorna o usuário (sem password) pelo ID.
   * Use no controller: GET /auth/profile/:id
   */
  async getProfileById(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
    return this.sanitizeUser(user);
  }

  /**
   * Atualiza campos de perfil no próprio User.
   * Aceita: username, email, phone, company, distanceKm.
   * Use no controller: PUT /auth/profile/:id
   */
  async updateProfileById(
    userId: string,
    data: { username?: string; email?: string; phone?: string; company?: string; distanceKm?: number }
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    if (data.username !== undefined) user.username = data.username;
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) (user as any).phone = data.phone;       // requer coluna 'phone' na entidade
    if (data.company !== undefined) (user as any).company = data.company; // requer coluna 'company' na entidade
    if (data.distanceKm !== undefined) user.distanceKm = data.distanceKm;

    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }
}
