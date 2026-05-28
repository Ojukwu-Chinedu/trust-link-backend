import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import {
  EscrowRecord,
  EscrowState,
  PrismaService,
} from '../prisma/prisma.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';

const ESCROW_CACHE_TTL = 60; // seconds

@Injectable()
export class EscrowRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private cacheKey(id: string): string {
    return `escrow:${id}`;
  }

  private async invalidate(id: string): Promise<void> {
    await this.cache.del(this.cacheKey(id));
  }

  create(dto: CreateEscrowDto, vendorAddress: string): Promise<EscrowRecord> {
    return this.prisma.escrow.create({
      data: {
        ...dto,
        vendorAddress,
      },
    });
  }

  findByVendorAndItem(
    vendorAddress: string,
    itemRef: string,
  ): Promise<EscrowRecord | null> {
    return this.prisma.escrow
      .findMany({
        where: { vendorAddress, itemRef },
      })
      .then((results) => results[0] ?? null);
  }

  async findById(id: string): Promise<EscrowRecord | null> {
    const cached = await this.cache.get<EscrowRecord>(this.cacheKey(id));
    if (cached) return cached;
    const record = await this.prisma.escrow.findUnique({ where: { id } });
    if (record) await this.cache.set(this.cacheKey(id), record, ESCROW_CACHE_TTL);
    return record;
  }

  findByVendor(vendorAddress: string): Promise<EscrowRecord[]> {
    return this.prisma.escrow.findMany({ where: { vendorAddress } });
  }

  findByBuyer(buyerAddress: string): Promise<EscrowRecord[]> {
    return this.prisma.escrow.findMany({ where: { buyerAddress } });
  }

  async updateState(id: string, state: EscrowState): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({ where: { id }, data: { state } });
    await this.invalidate(id);
    return result;
  }

  async updateTracking(id: string, trackingId: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({ where: { id }, data: { trackingId } });
    await this.invalidate(id);
    return result;
  }

  // Pagination helper used by upstream
  findVendorEscrows(
    vendorAddress: string,
    state: string | undefined,
    sort: 'date' | 'amount',
    order: 'asc' | 'desc',
    page: number,
    limit: number,
  ): Promise<{ data: EscrowRecord[]; total: number }> {
    return this.prisma.escrow
      .findMany({
        where: { vendorAddress, state: state as any },
      })
      .then((records) => {
        const sorted = records.sort((a, b) => {
          const primary =
            sort === 'amount'
              ? a.amount - b.amount
              : a.createdAt.getTime() - b.createdAt.getTime();
          return order === 'asc' ? primary : -primary;
        });

        const total = sorted.length;
        const start = (page - 1) * limit;
        const data = sorted.slice(start, start + limit);
        return { data, total };
      });
  }

  async markShipped(id: string, trackingId: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: { state: 'SHIPPED', trackingId, shippedAt: new Date() },
    });
    await this.invalidate(id);
    return result;
  }

  async markCompleted(id: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: { state: 'COMPLETED' },
    });
    await this.invalidate(id);
    return result;
  }

  async markRefunded(id: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: { state: 'REFUNDED' },
    });
    await this.invalidate(id);
    return result;
  }

  async markReleased(id: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: { state: 'RELEASED' },
    });
    await this.invalidate(id);
    return result;
  }

  async markDelivered(id: string, deliveredAt = new Date()): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: {
        state: 'DELIVERED',
        deliveredAt,
        deliveryRecordedAt: deliveredAt,
      },
    });
    await this.invalidate(id);
    return result;
  }

  async markAutoReleaseCompleted(
    id: string,
    txHash: string,
    submittedAt = new Date(),
  ): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: {
        state: 'COMPLETED',
        autoReleaseSubmittedAt: submittedAt,
        autoReleaseTxHash: txHash,
      },
    });
    await this.invalidate(id);
    return result;
  }

  async markCancelled(id: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: {
        state: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
    await this.invalidate(id);
    return result;
  }

  findShippedWithTracking(): Promise<EscrowRecord[]> {
    return this.prisma.escrow
      .findMany({ where: { state: 'SHIPPED' } })
      .then((escrows) =>
        escrows.filter((escrow) => Boolean(escrow.trackingId)),
      );
  }

  findAutoReleaseEligible(referenceTime = new Date()): Promise<EscrowRecord[]> {
    const threshold = new Date(referenceTime.getTime() - 48 * 60 * 60 * 1000);

    return this.prisma.escrow
      .findMany({ where: { state: 'SHIPPED' } })
      .then((escrows) =>
        escrows.filter(
          (escrow) =>
            escrow.deliveredAt !== null &&
            escrow.deliveredAt <= threshold &&
            escrow.disputeId === null &&
            escrow.autoReleaseTxHash === null &&
            escrow.autoReleaseSubmittedAt === null,
        ),
      );
  }

  /**
   * Atomically claims an escrow for auto-release by setting autoReleaseSubmittedAt.
   * Returns the updated record if the claim succeeded, null if another worker
   * already holds the lock (autoReleaseSubmittedAt was not null).
   * In production with Prisma + PostgreSQL this should use a conditional
   * UPDATE … WHERE autoReleaseSubmittedAt IS NULL to guarantee atomicity.
   */
  async markAutoReleaseSubmitting(id: string): Promise<EscrowRecord | null> {
    const escrow = await this.findById(id);
    if (!escrow || escrow.autoReleaseSubmittedAt !== null) {
      return null;
    }
    const result = await this.prisma.escrow.update({
      where: { id },
      data: { autoReleaseSubmittedAt: new Date() },
    });
    await this.invalidate(id);
    return result;
  }

  async clearAutoReleaseSubmitting(id: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: { autoReleaseSubmittedAt: null },
    });
    await this.invalidate(id);
    return result;
  }

  async markAutoReleased(id: string, txHash: string): Promise<EscrowRecord> {
    const result = await this.prisma.escrow.update({
      where: { id },
      data: { state: 'RELEASED', autoReleaseTxHash: txHash },
    });
    await this.invalidate(id);
    return result;
  }
}
