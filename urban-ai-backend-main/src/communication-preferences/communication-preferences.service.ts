import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCommunicationPreferences } from '../entities/user-communication-preferences.entity';
import { UpdateCommunicationPreferencesDto } from './communication-preferences.dto';

const DEFAULT_PREFERENCES = {
  emailPricing: true,
  pushPricing: true,
  weeklyReport: true,
  marketing: false,
  staysAlerts: true,
  billingAlerts: true,
};

@Injectable()
export class CommunicationPreferencesService {
  constructor(
    @InjectRepository(UserCommunicationPreferences)
    private readonly preferencesRepository: Repository<UserCommunicationPreferences>,
  ) {}

  async getForUser(userId: string): Promise<UserCommunicationPreferences> {
    const existing = await this.preferencesRepository.findOne({ where: { userId } });
    if (existing) return existing;

    return this.preferencesRepository.save(
      this.preferencesRepository.create({
        userId,
        ...DEFAULT_PREFERENCES,
      }),
    );
  }

  async updateForUser(
    userId: string,
    payload: UpdateCommunicationPreferencesDto,
  ): Promise<UserCommunicationPreferences> {
    const current = await this.getForUser(userId);
    const allowedKeys = Object.keys(DEFAULT_PREFERENCES) as Array<keyof typeof DEFAULT_PREFERENCES>;

    for (const key of allowedKeys) {
      if (typeof payload[key] === 'boolean') {
        current[key] = payload[key];
      }
    }

    return this.preferencesRepository.save(current);
  }
}
