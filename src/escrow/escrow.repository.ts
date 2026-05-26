import { Injectable } from '@nestjs/common';
import { EscrowRecord, PrismaService } from '../prisma/prisma.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';

@Injectable()
export class EscrowRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEscrowDto, vendorAddress: string): Promise<EscrowRecord> {
    return this.prisma.escrow.create({
      data: {
        ...dto,
        vendorAddress,
      },
    });
  }

  findById(id: string): Promise<EscrowRecord | null> {
    return this.prisma.escrow.findUnique({ where: { id } });
  }

  markShipped(id: string, trackingId: string): Promise<EscrowRecord> {
    return this.prisma.escrow.update({
      where: { id },
      data: { state: 'SHIPPED', trackingId },
    });
  }
}
