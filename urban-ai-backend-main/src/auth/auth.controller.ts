import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { User } from 'src/entities/user.entity';
import { AuthService, TokenPair } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ACCESS_TOKEN_COOKIE } from './jwt.strategy';
import { WaitlistService } from '../waitlist/waitlist.service';

const REFRESH_TOKEN_COOKIE = 'urbanai_refresh_token';

/** Duração máxima do access cookie — deve bater com JWT_EXPIRES_IN. */
const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // 15 min

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(forwardRef(() => WaitlistService))
    private readonly waitlistService: WaitlistService,
  ) {}

  /**
   * Pré-lançamento (F8): quando `PRELAUNCH_MODE=true` no Railway, novos
   * cadastros são redirecionados para a lista de espera em vez de virarem
   * `User` reais. Login segue funcionando para users já existentes (founders,
   * admins, beta testers convidados manualmente).
   */
  private isPrelaunchMode(): boolean {
    return process.env.PRELAUNCH_MODE === 'true';
  }

  /**
   * Configuração comum dos cookies.
   *
   * Em prod (subdomain split — Opção B):
   *   - secure: true
   *   - sameSite: lax
   *   - domain: `.myurbanai.com` — começa com ponto para o cookie ser
   *     compartilhado entre `myurbanai.com` e `app.myurbanai.com`. Sem isso,
   *     login feito em app.myurbanai.com não bate em myurbanai.com (e vice-
   *     versa) e usuário "perde sessão" ao navegar entre subdomains.
   *
   * Em dev local (`localhost`), `domain` fica `undefined` — o browser usa
   * o host atual e cookies funcionam normalmente entre /, /create, etc.
   *
   * O domínio do cookie pode ser overrideado via env `COOKIE_DOMAIN` para
   * casos de staging com domínio próprio (ex: `.staging.myurbanai.com`).
   */
  private cookieOpts(maxAgeMs: number, isRefresh = false) {
    const env = process.env.APP_ENV || process.env.NODE_ENV;
    const isProd = env === 'production' || env === 'staging';
    const cookieDomain =
      process.env.COOKIE_DOMAIN ?? (isProd ? '.myurbanai.com' : undefined);

    return {
      httpOnly: true,
      secure: isProd, // em dev local (http), cookies secure quebram o fluxo
      sameSite: 'lax' as const,
      domain: cookieDomain,
      path: isRefresh ? '/auth' : '/',
      maxAge: maxAgeMs,
    };
  }

  private setAuthCookies(res: Response, tokens: TokenPair) {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, this.cookieOpts(ACCESS_COOKIE_MAX_AGE_MS));
    const refreshMaxAge = tokens.refreshExpiresAt.getTime() - Date.now();
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, this.cookieOpts(refreshMaxAge, true));
  }

  private clearAuthCookies(res: Response) {
    // Para o browser invalidar o cookie corretamente, os atributos
    // (domain, path) precisam bater com os usados ao setar.
    const env = process.env.APP_ENV || process.env.NODE_ENV;
    const isProd = env === 'production' || env === 'staging';
    const cookieDomain =
      process.env.COOKIE_DOMAIN ?? (isProd ? '.myurbanai.com' : undefined);

    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/', domain: cookieDomain });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/auth', domain: cookieDomain });
  }

  @ApiOperation({ summary: 'Registrar um novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiBody({
    description: 'Dados para registro de usuário.',
    schema: {
      example: {
        username: 'Lucas',
        email: 'lucas@email.com',
        password: 'password123',
      },
    },
  })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  async register(
    @Body() data: {
      username: string;
      email: string;
      password: string;
      // F8: campos opcionais quando o front sabe que está em prelaunch e
      // já chama /auth/register pretendendo virar waitlist.
      source?: string;
      referredBy?: string;
    },
    @Req() req: Request,
  ) {
    // F8 — modo pré-lançamento.
    // Quando ligado, NÃO cria User real. Cria entrada na waitlist e
    // retorna { mode: 'waitlist', ...stats }. Front detecta `mode` e mostra
    // a tela de "você é o #N na fila" em vez de tentar fazer login.
    if (this.isPrelaunchMode()) {
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        null;
      const ua = (req.headers['user-agent'] as string) ?? null;
      const result = await this.waitlistService.signup({
        email: data.email,
        name: data.username,
        source: data.source ?? 'auth-register',
        referredBy: data.referredBy,
        signupIp: ip ?? undefined,
        userAgent: ua ?? undefined,
      });
      return {
        mode: 'waitlist',
        ...result,
      };
    }

    // Registro normal: cria User cru — o login separado estabelece a sessão.
    const user = await this.authService.register(data);
    return { mode: 'registered', user };
  }

  @ApiOperation({ summary: 'Autenticar um usuário e retornar um token' })
  @ApiResponse({ status: 201, description: 'Usuário autenticado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiBody({
    description: 'Credenciais de login do usuário',
    schema: {
      example: {
        email: 'email@dominio.com',
        password: 'password',
      },
    },
  })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  async login(
    @Body() data: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(data.email, data.password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setAuthCookies(res, tokens);
    // Retrocompat: ainda devolve o accessToken no body para clientes que
    // continuam usando localStorage. A Fase 2 do runbook remove isso.
    return { accessToken: tokens.accessToken };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('google')
  async googleLogin(
    @Body()
    googleUserData: {
      email: string;
      name: string;
      picture?: string;
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      if (!googleUserData.email) {
        throw new BadRequestException('Email não fornecido');
      }
      if (!googleUserData.name) {
        throw new BadRequestException('Nome não fornecido');
      }
      const result = await this.authService.googleLogin(googleUserData, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      this.setAuthCookies(res, result);
      // Retrocompat: accessToken no body (Fase 2 remove).
      return { accessToken: result.accessToken, user: result.user };
    } catch (error) {
      console.error('Erro no controller de login Google:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ocorreu um erro durante o processamento do login com Google',
      );
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!raw) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const tokens = await this.authService.rotateRefreshToken(raw, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (raw) {
      await this.authService.revokeRefreshToken(raw);
    }
    this.clearAuthCookies(res);
  }

  @ApiOperation({ summary: 'Excluir um usuário pelo ID' })
  @ApiResponse({ status: 200, description: 'Usuário excluído com sucesso' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID do usuário a ser excluído',
    example: '1',
  })
  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<void> {
    return this.authService.deleteUser(id);
  }

  @ApiOperation({ summary: 'Obter informações do usuário autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Dados do usuário retornados com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req) {
    return req.user;
  }

  @ApiOperation({ summary: 'Atualizar informações de um usuário pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Usuário atualizado com sucesso',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID do usuário a ser atualizado',
    example: '1',
  })
  @ApiBody({
    description:
      'Dados parciais para atualização do usuário. Todos os campos são opcionais.',
    schema: {
      example: {
        username: 'LucasAtualizado',
        email: 'lucasatualizado@email.com',
        password: 'novasenha123',
      },
    },
  })
  @Put(':id/update')
  async updateUser(
    @Param('id') id: string,
    @Body()
    data: {
      username?: string;
      email?: string;
      password?: string;
    },
  ): Promise<User> {
    return this.authService.update(id, data);
  }

  @ApiOperation({ summary: 'Obter informações de um usuário pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Usuário encontrado e retornado',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID do usuário a ser consultado',
    example: '1',
  })
  @UseGuards(JwtAuthGuard)
  @Get('user/:id')
  getUser(@Param('id') id: string) {
    return this.authService.findUserById(id);
  }

  // ===================== NOVOS ENDPOINTS DE PERFIL =====================

  @ApiOperation({ summary: 'Obter perfil (por ID do próprio usuário)' })
  @ApiParam({ name: 'id', example: 'uuid-do-user' })
  @ApiResponse({ status: 200, description: 'Perfil retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiBearerAuth() // Adicionado para documentação Swagger
  @UseGuards(JwtAuthGuard) // Adicionado guarda de autenticação
  @Get('profile/')
  async getProfileById(@Req() req) {

    return this.authService.getProfileById(req.user?.userId);
  }

  @ApiOperation({ summary: 'Atualizar perfil (por ID do próprio usuário)' })
  @ApiParam({ name: 'id', example: 'uuid-do-user' })
  @ApiBody({
    schema: {
      example: {
        username: 'João Silva',
        email: 'joao@email.com',
        phone: '+55 11 99999-9999',
        company: 'JS Hospedagem',
        distanceKm: 25,
        pricingStrategy: 'moderate',
        operationMode: 'notifications'
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiBearerAuth() // Adicionado para documentação Swagger
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfileById(
    @Body()
    body: {
      username?: string;
      email?: string;
      phone?: string;
      company?: string;
      distanceKm?: number;
      airbnbHostId?: string;
      pricingStrategy?: string;
      operationMode?: string;
      percentualInicial?: number;
      percentualFinal?: number;
    },
    @Req() req,
  ) {

    return this.authService.updateProfileById(req.user?.userId, body);
  }
}