import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePass {
  @ApiProperty({
    example: 'Df90Cz...reset-token',
    description: 'Token de redefinição enviado por e-mail',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: '9b74c9897bac770ffc029102a200c5de9f3a0e326e4d4a0f86d5f2a7bc01db57',
    description: 'Senha válida',
  })
  @IsString()
  @IsNotEmpty()
  pass: string;
}
