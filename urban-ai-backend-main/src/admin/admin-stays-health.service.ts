import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceUpdate } from '../entities/price-update.entity';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';

type StatusCountRow = {
  status: string;
  count: string | number;
};

/** Read-only operational health projection for the Stays integration. */
@Injectable()
export class AdminStaysHealthService {
  constructor(
    @InjectRepository(PriceUpdate)
    private readonly priceUpdateRepo: Repository<PriceUpdate>,
    @InjectRepository(StaysAccount)
    private readonly staysAccountRepo: Repository<StaysAccount>,
    @InjectRepository(StaysListing)
    private readonly staysListingRepo: Repository<StaysListing>,
  ) {}

  async getHealth() {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [accountsByStatus, totalListings, activeListings, pushByStatus, autoListings, recentPushes] = await Promise.all([
      this.staysAccountRepo
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('a.status')
        .getRawMany<StatusCountRow>(),
      this.staysListingRepo.count(),
      this.staysListingRepo.count({ where: { active: true } }),
      this.priceUpdateRepo
        .createQueryBuilder('pu')
        .select('pu.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('pu.createdAt >= :cutoff', { cutoff: cutoff30d })
        .groupBy('pu.status')
        .getRawMany<StatusCountRow>(),
      this.staysListingRepo.count({ where: { operationMode: 'auto' } }),
      this.priceUpdateRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['user', 'listing'],
      }),
    ]);

    return {
      readiness: {
        apiBaseConfigured: Boolean(process.env.STAYS_API_BASE_URL),
        tokenEncryptionConfigured: Boolean(process.env.STAYS_TOKEN_ENCRYPTION_KEY),
        betaPrivate: !process.env.STAYS_API_BASE_URL || !process.env.STAYS_TOKEN_ENCRYPTION_KEY,
        missingEnv: [
          !process.env.STAYS_API_BASE_URL ? 'STAYS_API_BASE_URL' : '',
          !process.env.STAYS_TOKEN_ENCRYPTION_KEY ? 'STAYS_TOKEN_ENCRYPTION_KEY' : '',
        ].filter(Boolean),
      },
      accountsByStatus: accountsByStatus.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      listings: {
        total: totalListings,
        active: activeListings,
        forcedAuto: autoListings,
      },
      pushLast30d: pushByStatus.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      recent: recentPushes.map((push) => ({
        id: push.id,
        targetDate: push.targetDate,
        previousPriceCents: push.previousPriceCents,
        newPriceCents: push.newPriceCents,
        origin: push.origin,
        status: push.status,
        errorMessage: push.errorMessage,
        createdAt: push.createdAt,
        userId: push.user?.id,
        listingId: push.listing?.id,
      })),
    };
  }
}
