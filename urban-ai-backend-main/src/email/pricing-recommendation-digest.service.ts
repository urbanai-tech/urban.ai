import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PricingRecommendationDigest } from 'src/entities/pricing-recommendation-digest.entity';
import { User } from 'src/entities/user.entity';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

export type PricingDigestItem = {
  notificationId?: string;
  title: string;
  description: string;
  redirectTo: string;
  propertyTitle: string;
  propertyNickname?: string;
  propertyCode?: string;
  propertyAddress?: string;
  currentPrice?: number | null;
  suggestedPrice?: number | null;
  liftPercent?: number | null;
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
    const now = new Date();
    const alreadySentEmailToday = input.wantsEmail
      ? await this.hasSentEmailToday(input.user.id, now)
      : false;
    const scheduledFor = alreadySentEmailToday
      ? this.startOfNextDay(now)
      : new Date(now.getTime() + input.delayMs);
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

    const items = this.upsertDigestItem(this.parseItems(digest.itemsJson), input.item);

    digest.recipientEmail = input.user.email;
    digest.recipientName = input.user.username || 'Usuario';
    digest.wantsEmail = Boolean(digest.wantsEmail || input.wantsEmail);
    digest.wantsPush = Boolean(digest.wantsPush || input.wantsPush);
    digest.itemsJson = JSON.stringify(items);
    digest.itemCount = items.length;
    digest.failureReason = null;
    if (!existing) {
      digest.scheduledFor = scheduledFor;
    } else if (alreadySentEmailToday && digest.scheduledFor < scheduledFor) {
      digest.scheduledFor = scheduledFor;
    }

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

  async markSkipped(id: string, reason: string): Promise<void> {
    await this.digestRepo.update(id, {
      status: 'skipped',
      sentAt: new Date(),
      failureReason: reason.slice(0, 4000),
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

  private async hasSentEmailToday(userId: string, now: Date): Promise<boolean> {
    const sentToday = await this.digestRepo.findOne({
      where: {
        userId,
        status: 'sent',
        wantsEmail: true,
        sentAt: MoreThanOrEqual(this.startOfDay(now)),
      },
      order: { sentAt: 'DESC' },
    });
    return Boolean(sentToday);
  }

  private upsertDigestItem(items: PricingDigestItem[], nextItem: PricingDigestItem): PricingDigestItem[] {
    const duplicateIndex = items.findIndex((item) => this.digestItemKey(item) === this.digestItemKey(nextItem));
    if (duplicateIndex === -1) return [...items, nextItem];

    const updated = [...items];
    updated[duplicateIndex] = {
      ...updated[duplicateIndex],
      ...nextItem,
      reasons: this.uniqueStrings([...(updated[duplicateIndex].reasons || []), ...(nextItem.reasons || [])]).slice(0, 4),
      createdAt: updated[duplicateIndex].createdAt || nextItem.createdAt,
    };
    return updated;
  }

  private digestItemKey(item: PricingDigestItem): string {
    if (item.notificationId) return `notification:${item.notificationId}`;

    const day = this.itemDay(item.createdAt);
    const redirectTo = this.normalizeKeyPart(item.redirectTo);
    const propertyTitle = this.normalizeKeyPart(item.propertyTitle);
    return `property:${redirectTo}:${propertyTitle}:${day}`;
  }

  private itemDay(value?: string): string {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  }

  private normalizeKeyPart(value?: string | null): string {
    return (value || '').trim().toLowerCase();
  }

  private uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
  }

  private startOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private startOfNextDay(value: Date): Date {
    const start = this.startOfDay(value);
    start.setDate(start.getDate() + 1);
    return start;
  }
}
