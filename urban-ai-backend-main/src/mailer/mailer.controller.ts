import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MailerService } from './mailer.service';
import { SendEmailDto } from './tdo/sendEmail.tdo';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';


@ApiTags('Mailer') // aparece como grupo no Swagger
@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Enviar e-mail usando template' })
  @ApiResponse({
    status: 201,
    description: 'E-mail enviado com sucesso',
    schema: {
      example: {
        status: 'success',
        message: 'Email enviado para client@domain.com',
      },
    },
  })
  async sendEmail(@Body() dto: SendEmailDto) {
    await this.mailerService.sendTemplateEmail(
      { email: dto.email, name: dto.name },
      dto.subject,
      dto.templateId,
      dto.variables,
    );

    return {
      status: 'success',
      message: 'Email enviado',
    };
  }
}
