import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Req,
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
import { User } from 'src/entities/user.entity';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @Post('register')
  async register(
    @Body() data: {
      username: string;
      email: string;
      password: string;
    },
  ) {
    return this.authService.register(data);
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
  @Post('login')
  login(@Body() data: { email: string; password: string }) {
    return this.authService.login(data.email, data.password);
  }

  @Post('google')
  async googleLogin(
    @Body()
    googleUserData: {
      email: string;
      name: string;
      picture?: string;
    },
  ) {
    try {
      if (!googleUserData.email) {
        throw new BadRequestException('Email não fornecido');
      }
      if (!googleUserData.name) {
        throw new BadRequestException('Nome não fornecido');
      }
      return this.authService.googleLogin(googleUserData);
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
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiBearerAuth() // Adicionado para documentação Swagger
  @UseGuards(JwtAuthGuard) // Adicionado guarda de autenticação
  @Put('profile')
  async updateProfileById(
    @Body()
    body: {
      username?: string;
      email?: string;
      phone?: string;
      company?: string;
      distanceKm?: number;
    },
    @Req() req,
  ) {

    return this.authService.updateProfileById(req.user?.userId, body);
  }
}