import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCommunicationPreferences } from '../entities/user-communication-preferences.entity';
import { UpdateCommunicationPreferencesDto } from './communication-preferences.dto';
import { UnsubscribeCategory } from './unsubscribe-token';

const DEFAULT_PREFERENCES = {
  emailPricing: true,
  pushPricing: true,
  weeklyReport: true,
  onboardingEmails: true,
  marketing: false,
  staysAlerts: true,
  billingAlerts: true,
};

const UNSUBSCRIBE_FIELD: Record<UnsubscribeCategory, 'onboardingEmails' | 'weeklyReport' | 'emailPricing' | 'marketing'> = {
  onboarding: 'onboardingEmails',
  weekly_report: 'weeklyReport',
  pricing: 'emailPricing',
  marketing: 'marketing',
};

@Injectable()
export class CommunicationPreferencesService {
  private readonly logger = new Logger(CommunicationPreferencesService.name);

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

  /**
   * Descadastro por link assinado (sem login). Idempotente: desligar uma
   * preferência já desligada não muda nada. Usuário removido => no-op silencioso.
   */
  async unsubscribe(userId: string, category: UnsubscribeCategory): Promise<void> {
    const field = UNSUBSCRIBE_FIELD[category];
    try {
      const current = await this.getForUser(userId);
      if (current[field] === false) return;
      current[field] = false;
      await this.preferencesRepository.save(current);
    } catch (error) {
      this.logger.warn(`unsubscribe falhou userId=${userId} category=${category}: ${(error as Error)?.message}`);
    }
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
