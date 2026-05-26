import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { EscrowRecord } from '../prisma/prisma.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { EscrowRepository } from './escrow.repository';

@Injectable()
export class EscrowService {
  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createEscrow(
    dto: CreateEscrowDto,
    vendorAddress: string,
  ): Promise<EscrowRecord> {
    const escrow = await this.escrowRepository.create(dto, vendorAddress);
    await this.notificationsService.notifyFunded(escrow);
    return escrow;
  }

  async findById(id: string): Promise<EscrowRecord> {
    const escrow = await this.escrowRepository.findById(id);
    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }
    return escrow;
  }

  async handleShipment(
    escrowId: string,
    vendorAddress: string,
    trackingId: string,
  ): Promise<EscrowRecord> {
    if (!trackingId.trim()) {
      throw new BadRequestException('Tracking ID is required');
    }

    const escrow = await this.findById(escrowId);
    if (escrow.vendorAddress !== vendorAddress) {
      throw new ForbiddenException(
        'Only the escrow vendor can ship this order',
      );
    }

    if (escrow.state !== 'FUNDED') {
      throw new BadRequestException('Escrow must be funded before shipment');
    }

    const shipped = await this.escrowRepository.markShipped(
      escrow.id,
      trackingId,
    );
    await this.notificationsService.notifyShipped(shipped);
    return shipped;
  }
}
