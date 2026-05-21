import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: 'Nova Mensagem' })
  title: string;

  @ApiProperty({ example: 'Você recebeu uma nova mensagem do sistema' })
  description?: string;

  @ApiProperty({ example: 'Abrir Mensagem', required: false })
  titleButton?: string;

  @ApiProperty({ example: '/messages/123', required: false })
  redirectTo?: string;

  @ApiProperty({ example: true, required: false })
  sendEmail?: boolean;

  @ApiProperty({ example: true, required: false })
  sendPush?: boolean;

  @ApiProperty({ example: 'pricing-list-123', required: false })
  pushTag?: string;

  @ApiProperty({ example: 'pricing_recommendation', required: false })
  pushType?: string;
}
