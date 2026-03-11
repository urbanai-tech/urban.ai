// src/user/user.controller.ts
import {
    Body,
    Controller,
    Get,
    Post,
    Query,
    Req,
    UseGuards,
  } from '@nestjs/common';
  import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
  import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
  import { UserService } from './user.service';
  
  @ApiTags('Usuários')
  @Controller('users')
  export class UserController {
    constructor(private readonly userService: UserService) {}
  
    
    @Get('me/has-address')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Verifica se o usuário logado possui ao menos um endereço' })
    @ApiQuery({ name: 'onlyActive', required: false, type: Boolean, example: true })
    async hasMyAddress(@Req() req: any, @Query('onlyActive') onlyActive = 'true') {
      const userId: string | undefined = req.user?.userId ?? req.user?.sub;
      const onlyActiveBool = String(onlyActive).toLowerCase() !== 'false';
      console.log(req.user)
      return this.userService.userHasAnyAddress(userId!, onlyActiveBool);
      // Se preferir só booleano:
      // const res = await this.userService.userHasAnyAddress(userId!, onlyActiveBool);
      // return res.hasAddress;
    }
  }
  