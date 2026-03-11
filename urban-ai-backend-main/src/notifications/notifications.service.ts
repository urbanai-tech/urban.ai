import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from 'src/entities/notification.entity';
import { User } from 'src/entities/user.entity';
import { CreateNotificationDto } from './tdo/create-notification.dto';


@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(userId: string, dto: CreateNotificationDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const notification = this.notificationRepository.create({
      ...dto,
      user,
      sent: true,
    });

    return await this.notificationRepository.save(notification);
  }

  async markAsOpened(id: string) {
    const notification = await this.notificationRepository.findOne({ where: { id } });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.opened = true;
    return await this.notificationRepository.save(notification);
  }

  async countUnreadByUser(userId: string): Promise<number> {
  const count = await this.notificationRepository.count({
    where: {
      user: { id: userId },
      opened: false,
    },
  });

  return count;
}


  async findAllByUser(userId: string, page = 1, limit = 10) {
    const [result, total] = await this.notificationRepository.findAndCount({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: result,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }
}
