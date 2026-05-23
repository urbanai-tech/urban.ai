import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PricingRecommendationDigest } from 'src/entities/pricing-recommendation-digest.entity';
import { User } from 'src/entities/user.entity';
import { LessThanOrEqual, Repository } from 'typeorm';

export type PricingDigestItem = {
  notificationId?: string;
  title: string;
  description: string;
  redirectTo: string;
  propertyTitle: string;
  reasons: string[];
  createdAt: string;
};

export type ClaimedPricingDigest = {
  id: string;
  userId: string;
  email: string;
  name: string;
  wantsEmail: boolean;
  wantsPush: boolean;
  items: PricingDigestItem[];
};

@Injectable()
export class PricingRecommendationDigestService {
  private readonly logger = new Logger(PricingRecommendationDigestService.name);

  constructor(
    @InjectRepository(PricingRecommendationDigest)
    private readonly digestRepo: Repository<PricingRecommendationDigest>,
  ) {}

  async appendPendingDigest(input: {
    user: User;
    item: PricingDigestItem;
    wantsEmail: boolean;
    wantsPush: boolean;
    delayMs: number;
  }): Promise<PricingRecommendationDigest> {
    const scheduledFor = new Date(Date.now() + input.delayMs);
    const existing = await this.digestRepo.findOne({
      where: { userId: input.user.id, status: 'pending' },
      order: { scheduledFor: 'ASC' },
    });

    const digest =
      existing ||
      this.digestRepo.create({
        userId: input.user.id,
        user: input.user,
        itemsJson: '[]',
        itemCount: 0,
        status: 'pending',
        scheduledFor,
      });

    const items = this.parseItems(digest.itemsJson);
    items.push(input.item);

    digest.recipientEmail = input.user.email;
    digest.recipientName = input.user.username || 'Usuario';
    digest.wantsEmail = Boolean(digest.wantsEmail || input.wantsEmail);
    digest.wantsPush = Boolean(digest.wantsPush || input.wantsPush);
    digest.itemsJson = JSON.stringify(items);
    digest.itemCount = items.length;
    digest.failureReason = null;
    if (!existing) digest.scheduledFor = scheduledFor;

    return this.digestRepo.save(digest);
  }

  async claimDueDigest(userId?: string, now = new Date()): Promise<ClaimedPricingDigest | null> {
    const digest = await this.digestRepo.findOne({
      where: {
        ...(userId ? { userId } : {}),
        status: 'pending',
        scheduledFor: LessThanOrEqual(now),
      },
      order: { scheduledFor: 'ASC' },
    });

    if (!digest) return null;

    const claim = await this.digestRepo.update(
      { id: digest.id, status: 'pending' },
      { status: 'sending', lockedAt: new Date(), failureReason: null },
    );
    if (!claim.affected) return null;

    const claimed = await this.digestRepo.findOne({ where: { id: digest.id } });
    if (!claimed) return null;

    const items = this.parseItems(claimed.itemsJson);
    if (!items.length) {
      await this.markSent(claimed.id);
      return null;
    }

    return {
      id: claimed.id,
      userId: claimed.userId,
      email: claimed.recipientEmail,
      name: claimed.recipientName || 'Usuario',
      wantsEmail: claimed.wantsEmail,
      wantsPush: claimed.wantsPush,
      items,
    };
  }

  async markSent(id: string): Promise<void> {
    await this.digestRepo.update(id, {
      status: 'sent',
      sentAt: new Date(),
      failureReason: null,
    });
  }

  async markFailed(id: string, error: unknown): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);
    await this.digestRepo.update(id, {
      status: 'failed',
      failureReason: reason.slice(0, 4000),
    });
    this.logger.warn(`pricing digest failed id=${id}: ${reason}`);
  }

  private parseItems(value?: string | null): PricingDigestItem[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
    } catch (error) {
      this.logger.warn(`invalid pricing digest payload: ${(error as Error)?.message ?? String(error)}`);
      return [];
    }
  }
}
