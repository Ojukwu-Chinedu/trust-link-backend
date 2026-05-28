import { Injectable } from '@nestjs/common';
import {
  DisputeRecord,
  DisputeState,
  EscrowState,
  PrismaService,
} from '../prisma/prisma.service';

@Injectable()
export class DisputeRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    escrowId: string;
    reason: string;
    description: string;
    evidenceUrls?: string[];
    status?: DisputeState;
  }): Promise<DisputeRecord> {
    return this.prisma.dispute.create({ data });
  }

  findById(id: string): Promise<DisputeRecord | null> {
    return this.prisma.dispute.findUnique({ where: { id } });
  }

  async findByEscrow(escrowId: string): Promise<DisputeRecord | null> {
    const disputes = await this.prisma.dispute.findMany({
      where: { escrowId },
    });
    return disputes[0] ?? null;
  }

  findAllOpen(): Promise<DisputeRecord[]> {
    return this.prisma.dispute
      .findMany()
      .then((disputes) =>
        disputes.filter(
          (dispute) =>
            dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW',
        ),
      );
  }

  async resolve(
    disputeId: string,
    escrowState: EscrowState = 'COMPLETED',
  ): Promise<DisputeRecord> {
    const dispute = await this.findById(disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    const resolvedAt = new Date();
    const resolvedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'RESOLVED', resolvedAt },
    });

    await this.prisma.escrow.update({
      where: { id: dispute.escrowId },
      data: { state: escrowState, disputeId: null },
    });

    return resolvedDispute;
  }
}
