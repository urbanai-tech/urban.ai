import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from 'src/entities/user.entity';
import { RefreshToken } from 'src/entities/refresh-token.entity';
import { v4 as uuidv4 } from 'uuid';
import { PaymentsService } from 'src/payments/payments.service';
import { ConflictException } from '@nestjs/common';

const BCRYPT_ROUNDS = 12;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;
const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_DAYS = 7;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private refreshTokenRepository: Repository<RefreshToken>,
    private readonly paymentsService: PaymentsService
  ) { }

  // ============ Tokens ============

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Emite um novo par access+refresh para o usuário. O refresh é persistido
   * como hash; só o valor bruto vai para o cliente (via cookie httpOnly).
   */
  async issueTokens(user: User, meta?: { userAgent?: string; ip?: string }): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: user.id, username: user.username });

    const rawRefresh = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const record = this.refreshTokenRepository.create({
      user,
      tokenHash: this.hashRefreshToken(rawRefresh),
      expiresAt: refreshExpiresAt,
      userAgent: meta?.userAgent?.slice(0, 255) ?? null,
      ip: meta?.ip?.slice(0, 64) ?? null,
    });
    await this.refreshTokenRepository.save(record);

    return { accessToken, refreshToken: rawRefresh, refreshExpiresAt };
  }

  /**
   * Refresh token rotation: valida o token bruto contra a linha armazenada,
   * revoga a linha atual e emite um novo par. Reutilização de um refresh já
   * revogado derruba TODAS as sessões do usuário (detecção de roubo).
   */
  async rotateRefreshToken(rawRefresh: string, meta?: { userAgent?: string; ip?: string }): Promise<TokenPair> {
    if (!rawRefresh) throw new UnauthorizedException('Refresh token ausente');
    const hash = this.hashRefreshToken(rawRefresh);
    const record = await this.refreshTokenRepository.findOne({
      where: { tokenHash: hash },
      relations: ['user'],
    });
    if (!record) throw new UnauthorizedException('Refresh token inválido');

    if (record.revokedAt) {
      // Reuso de token revogado — possível roubo. Derrubar todas as sessões
      // do mesmo usuário por segurança.
      await this.refreshTokenRepository.update(
        { user: { id: record.user.id }, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Refresh token reutilizado — sessão encerrada por segurança');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    record.revokedAt = new Date();
    await this.refreshTokenRepository.save(record);

    return this.issueTokens(record.user, meta);
  }

  /** Revoga um refresh específico (logout de uma sessão). */
  async revokeRefreshToken(rawRefresh: string): Promise<void> {
    if (!rawRefresh) return;
    const hash = this.hashRefreshToken(rawRefresh);
    await this.refreshTokenRepository.update(
      { tokenHash: hash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Revoga todos os refresh tokens de um usuário (logout-all). */
  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { user: { id: userId }, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // ============ Senha (SHA-256 → bcrypt lazy migration) ============

  /** bcrypt hashes começam com $2a$, $2b$ ou $2y$ */
  private isBcryptHash(hash: string): boolean {
    return typeof hash === 'string' && /^\$2[aby]\$/.test(hash);
  }

  /** Hex 64-char: hash SHA-256 legado (ou pré-hash vindo do frontend) */
  private isSha256Hash(hash: string): boolean {
    return typeof hash === 'string' && SHA256_HEX_REGEX.test(hash);
  }

  /** SHA-256 simples sem salt — mantido apenas para comparação com hashes legados */
  private sha256(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Hashes a plaintext password with bcrypt(12).
   * O input pode ser a senha em texto puro OU um pré-hash SHA-256 vindo do
   * frontend (legado): nos dois casos, o valor entrada vira bcrypt.
   */
  private async bcryptHash(passwordOrSha256: string): Promise<string> {
    return bcrypt.hash(passwordOrSha256, BCRYPT_ROUNDS);
  }

  /**
   * Verifica a senha submetida contra o hash armazenado.
   * Aceita três formatos de `storedHash`: bcrypt (futuro padrão), SHA-256 hex
   * (legado atual) e `google_*` (conta Google, nunca autentica por senha).
   * Retorna { ok, needsRehash } — se ok=true e needsRehash=true, o caller deve
   * atualizar o registro para bcrypt de forma transparente.
   */
  private async verifyPassword(
    submitted: string,
    storedHash: string,
  ): Promise<{ ok: boolean; needsRehash: boolean }> {
    if (!storedHash || storedHash.startsWith('google_')) {
      return { ok: false, needsRehash: false };
    }

    if (this.isBcryptHash(storedHash)) {
      // Caminho novo: o hash no banco já é bcrypt. O input pode ser
      // texto-puro ou pré-hash SHA-256 (frontend legado) — tentamos ambos.
      if (await bcrypt.compare(submitted, storedHash)) {
        return { ok: true, needsRehash: false };
      }
      if (!this.isSha256Hash(submitted)) {
        const asSha = this.sha256(submitted);
        if (await bcrypt.compare(asSha, storedHash)) {
          return { ok: true, needsRehash: false };
        }
      }
      return { ok: false, needsRehash: false };
    }

    if (this.isSha256Hash(storedHash)) {
      // Caminho legado: o hash no banco é SHA-256 puro. Comparamos tanto o
      // pré-hash (caso o front já tenha mandado SHA-256) quanto o texto-puro.
      const submittedSha = this.isSha256Hash(submitted) ? submitted : this.sha256(submitted);
      if (submittedSha === storedHash) {
        return { ok: true, needsRehash: true };
      }
      return { ok: false, needsRehash: false };
    }

    return { ok: false, needsRehash: false };
  }

  /** Remove o campo password do objeto retornado para o cliente. */
  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...safe } = user as User & { password?: string };
    return safe;
  }

  async register(data: { username: string; email: string; password: string }) {
    // Verifica se e-mail já existe
    const existingUser = await this.userRepository.findOne({ where: { email: data.email } });
    if (existingUser) {
      throw new ConflictException('O e-mail informado já está em uso.');
    }

    // Novos registros entram direto com bcrypt(12), seja o input texto-puro
    // ou pré-hash SHA-256 vindo do frontend.
    const pwdHash = await this.bcryptHash(data.password);

    try {
      const user = this.userRepository.create({ ...data, password: pwdHash });
      const savedUser = await this.userRepository.save(user);
      await this.paymentsService.createPayment(savedUser);

      return savedUser;
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      throw new InternalServerErrorException('Falha no registro do usuário. Verifique com o suporte.');
    }
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
      // Toda atualização de senha passa por bcrypt(12), independente de
      // o input ser texto-puro ou pré-hash SHA-256 vindo do frontend legado.
      user.password = await this.bcryptHash(data.password);
    }

    return this.userRepository.save(user);
  }

  async login(email: string, password: string, meta?: { userAgent?: string; ip?: string }) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const { ok, needsRehash } = await this.verifyPassword(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    if (needsRehash) {
      // Lazy migration: usuário autenticou com SHA-256 legado. Re-hash para
      // bcrypt(12) transparentemente — próximo login já valida pelo caminho novo.
      try {
        user.password = await this.bcryptHash(password);
        await this.userRepository.save(user);
      } catch (error) {
        // Não falha o login se o re-hash falhar; é melhor-esforço.
        console.error('Falha ao migrar senha para bcrypt (usuário ainda autenticado):', error);
      }
    }

    return this.issueTokens(user, meta);
  }

  async googleLogin(
    userData: {
      token?: string;
      email: string;
      name: string;
      picture?: string;
    },
    meta?: { userAgent?: string; ip?: string },
  ) {
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

      const tokens = await this.issueTokens(user, meta);
      return {
        ...tokens,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
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
    data: { username?: string; email?: string; phone?: string; company?: string; distanceKm?: number; airbnbHostId?: string; pricingStrategy?: string; operationMode?: string; percentualInicial?: number; percentualFinal?: number; }
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    if (data.username !== undefined) user.username = data.username;
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) (user as any).phone = data.phone;       
    if (data.company !== undefined) (user as any).company = data.company; 
    if (data.distanceKm !== undefined) user.distanceKm = data.distanceKm;
    if (data.airbnbHostId !== undefined) user.airbnbHostId = data.airbnbHostId;
    if (data.pricingStrategy !== undefined) user.pricingStrategy = data.pricingStrategy;
    if (data.operationMode !== undefined) user.operationMode = data.operationMode;
    if (data.percentualInicial !== undefined) user.percentualInicial = data.percentualInicial;
    if (data.percentualFinal !== undefined) user.percentualFinal = data.percentualFinal;

    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }
}
