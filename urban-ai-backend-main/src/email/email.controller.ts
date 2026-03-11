import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';

import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/connect/connect.controller';
import { IsEmail } from 'class-validator';
import { User } from 'src/entities/user.entity';
import { CreateNotificationDto } from 'src/notifications/tdo/create-notification.dto';

export class SendEmailDto {
    @ApiProperty()
    email: string;

    @ApiProperty()
    nome: string;

    @ApiProperty()
    assunto: string;

    @ApiProperty()
    quantidade: number;
}

export class ConfirmarEmailWithCodeAndIdDto {
    @ApiProperty()
    email: string;
    @ApiProperty()
    codigo: string;
}
export class ForgotPassword {
    @ApiProperty({ example: 'usuario@teste.com', description: 'E-mail do usuário' })
    @IsEmail({}, { message: 'E-mail inválido' })
    email: string;
}
export class VerificarUsuario {
    @ApiProperty({ example: 'usuario@teste.com', description: 'E-mail do usuário' })
    @IsEmail({}, { message: 'E-mail inválido' })
    email: string;
}

export class EnviarCodigo {
    @ApiProperty({ example: '6f4c52ca-7f0f-4365-8071-db75ad6efff7', description: 'Id do usuário' })
    userId: string;
}

export class UpdatePass {
    @ApiProperty({ example: '6f4c52ca-7f0f-4365-8071-db75ad6efff7', description: 'Id do usuário' })
    @IsEmail({}, { message: 'Id inválido' })
    userId: string;

    @ApiProperty({ example: '9b74c9897bac770ffc029102a200c5de9f3a0e326e4d4a0f86d5f2a7bc01db57', description: 'Senha válida' })
    pass: string;
}
export class Nada {
    @ApiProperty()
    email: string;

    @ApiProperty()
    nome: string;

    @ApiProperty()
    assunto: string;

    @ApiProperty()
    quantidade: number;
}





@ApiTags('Email')
@Controller('email')
export class EmailController {
    constructor(private readonly emailService: EmailService) { }

    @Post()
    @ApiOperation({ summary: 'Enviar e-mail personalizado' })
    @ApiBody({ type: SendEmailDto })
    @ApiResponse({ status: 201, description: 'E-mail enviado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
    async enviar(@Body() body: SendEmailDto) {
        return this.emailService.sendEmail(body.email, body.nome, body.assunto, body.quantidade);
    }

    @Post('verificar-usuario-state')
    @ApiOperation({ summary: 'Verificar status do usuário' })
    @ApiBody({ type: VerificarUsuario })
    @ApiResponse({ status: 201, description: 'Status verificado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
    async verificarUsuarioState(@Body() body: VerificarUsuario) {
        return this.emailService.verificarUserEmail(body.email);
    }

    @Post('enviar-codigo')
    @ApiOperation({ summary: 'Enviar código de verificação' })
    @ApiBody({ type: VerificarUsuario })
    @ApiResponse({ status: 201, description: 'Código enviado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
    async enviarCodigo(@Body() body: VerificarUsuario) {
        return this.emailService.enviarCodigo(body.email);
    }

    @Post(':usuarioId/enviar-notification')
    @ApiOperation({ summary: 'Enviar notificação para um usuário' })
    @ApiParam({ name: 'usuarioId', description: 'ID do usuário que receberá a notificação' })
    @ApiBody({ type: CreateNotificationDto })
    @ApiResponse({ status: 201, description: 'Notificação enviada com sucesso.' })
    @ApiResponse({ status: 400, description: 'Erro ao enviar notificação.' })
    async enviarNotification(
        @Param('usuarioId') usuarioId: string,
        @Body() notificationContent: CreateNotificationDto,
    ) {
        return this.emailService.enviarNotification(usuarioId, notificationContent);
    }


    @Post('confirmar-email')
    @ApiOperation({ summary: 'Confirmar email com código de verificação' })
    @ApiBody({ type: ConfirmarEmailWithCodeAndIdDto })
    @ApiResponse({ status: 200, description: 'Email confirmado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Código inválido ou expirado.' })
    async confirmarEmail(@Body() body: ConfirmarEmailWithCodeAndIdDto) {
        return this.emailService.confirmarEmail(body.email, body.codigo);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a user profile by ID' })
    @ApiParam({ name: 'id', description: 'User UUID' })
    @ApiResponse({ status: 200, description: 'User found', type: User })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getProfile(@Param('id') userId: string): Promise<Partial<User>> {
        const user = await this.emailService.getProfileById(userId);
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }
        // Retorna o usuário sem a senha (Partial<User> já exclui o password)
        return user;
    }


    @Post('forgot-password')
    @ApiOperation({ summary: 'Enviar e-mail de recuperação de senha' })
    @ApiBody({ type: VerificarUsuario })
    @ApiResponse({ status: 201, description: 'E-mail enviado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
    async forgotPassword(@Body() body: VerificarUsuario) {
        return this.emailService.forgotPassword(body.email);
    }

    @Post('update-password')
    @ApiOperation({ summary: 'Atualizar senha' })
    @ApiBody({ type: UpdatePass })
    @ApiResponse({ status: 201, description: 'Senha atualizado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
    async updatePassword(@Body() body: UpdatePass) {
        console.log("usuário", body)
        return this.emailService.confirmPassword(body.userId, body?.pass);
    }

    @Get()
    @ApiOperation({ summary: 'Teste compilação' })
    @ApiResponse({ status: 201, description: 'E-mail enviado com sucesso.' })
    @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
    async teste() {
        return this.emailService.compilarEventosUnicosUsuarios()
    }
}
