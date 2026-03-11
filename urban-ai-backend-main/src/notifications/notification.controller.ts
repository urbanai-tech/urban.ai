import {
    Controller,
    Post,
    Patch,
    Get,
    Param,
    Body,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CreateNotificationDto } from './tdo/create-notification.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Post(':userId')
    @ApiResponse({ status: 201, description: 'Notification created' })
    async create(
        @Param('userId') userId: string,
        @Body() dto: CreateNotificationDto,
    ) {
        return this.notificationsService.create(userId, dto);
    }

    @Patch(':id/opened')
    @ApiResponse({ status: 200, description: 'Notification marked as opened' })
    async markAsOpened(@Param('id') id: string) {
        return this.notificationsService.markAsOpened(id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('user/unread-count')
    @ApiResponse({ status: 200, description: 'Unread notifications count' })
    async getUnreadCount(@Req() req: any) {
        const userId = req?.user?.userId;
        return {
            unread: await this.notificationsService.countUnreadByUser(userId),
        };
    }


    @UseGuards(JwtAuthGuard)
    @Get('user')
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiResponse({ status: 200, description: 'List of notifications' })
    async findAllByUser(
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Req() req: any,
    ) {
        console.log(req?.user?.userId)
        return this.notificationsService.findAllByUser(req?.user?.userId, +page, +limit);
    }
}
