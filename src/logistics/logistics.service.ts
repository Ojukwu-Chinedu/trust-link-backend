import { Injectable } from '@nestjs/common';

export type LogisticsStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED';

@Injectable()
export class LogisticsService {
  async getStatus(trackingId: string): Promise<{ status: LogisticsStatus }> {
    throw new Error(`Logistics service is not configured for ${trackingId}`);
  }
}
