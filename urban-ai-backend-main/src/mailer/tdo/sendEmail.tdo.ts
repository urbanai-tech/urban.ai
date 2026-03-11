import { ApiProperty } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({ example: 'client@domain.com' })
  email: string;

  @ApiProperty({ example: 'João Cliente' })
  name: string;

  @ApiProperty({ example: 'Bem-vindo à nossa plataforma 🚀' })
  subject: string;

  @ApiProperty({ example: 'TEMPLATE_ID_AQUI' })
  templateId: string;

  @ApiProperty({
    example: {
      userName: 'João',
      supportEmail: 'support@yourdomain.com',
    },
    description: 'Variáveis dinâmicas que serão injetadas no template',
  })
  variables?: Record<string, any>;
}
