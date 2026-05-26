import { Injectable, OnModuleDestroy } from '@nestjs/common';

export type EscrowState = 'FUNDED' | 'SHIPPED' | 'DELIVERED' | 'RELEASED';
export type NotificationChannel = 'EMAIL' | 'SMS';
export type NotificationType = 'FUNDED' | 'SHIPPED';

export interface EscrowRecord {
  id: string;
  itemName: string;
  amount: number;
  currency: string;
  buyerAddress: string;
  vendorAddress: string;
  state: EscrowState;
  trackingId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRecord {
  id: string;
  escrowId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipientAddress: string;
  providerMessageId: string | null;
  createdAt: Date;
}

type EscrowCreateInput = Omit<
  EscrowRecord,
  'id' | 'state' | 'trackingId' | 'createdAt' | 'updatedAt'
> & {
  state?: EscrowState;
  trackingId?: string | null;
};

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private escrows = new Map<string, EscrowRecord>();
  private notifications = new Map<string, NotificationRecord>();
  private escrowId = 1;
  private notificationId = 1;

  escrow = {
    create: ({ data }: { data: EscrowCreateInput }): Promise<EscrowRecord> => {
      const now = new Date();
      const escrow: EscrowRecord = {
        ...data,
        id: String(this.escrowId++),
        state: data.state ?? 'FUNDED',
        trackingId: data.trackingId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.escrows.set(escrow.id, escrow);
      return Promise.resolve({ ...escrow });
    },
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<EscrowRecord | null> => {
      const escrow = this.escrows.get(where.id);
      return Promise.resolve(escrow ? { ...escrow } : null);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Pick<EscrowRecord, 'state' | 'trackingId'>>;
    }): Promise<EscrowRecord> => {
      const existing = this.escrows.get(where.id);
      if (!existing) {
        throw new Error(`Escrow ${where.id} not found`);
      }
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.escrows.set(where.id, updated);
      return Promise.resolve({ ...updated });
    },
    deleteMany: (): Promise<{ count: number }> => {
      const count = this.escrows.size;
      this.escrows.clear();
      return Promise.resolve({ count });
    },
  };

  notification = {
    create: ({
      data,
    }: {
      data: Omit<NotificationRecord, 'id' | 'createdAt'>;
    }): Promise<NotificationRecord> => {
      const notification: NotificationRecord = {
        ...data,
        id: String(this.notificationId++),
        createdAt: new Date(),
      };
      this.notifications.set(notification.id, notification);
      return Promise.resolve({ ...notification });
    },
    findMany: (): Promise<NotificationRecord[]> =>
      Promise.resolve(
        [...this.notifications.values()].map((notification) => ({
          ...notification,
        })),
      ),
    deleteMany: (): Promise<{ count: number }> => {
      const count = this.notifications.size;
      this.notifications.clear();
      return Promise.resolve({ count });
    },
  };

  async reset(): Promise<void> {
    await this.notification.deleteMany();
    await this.escrow.deleteMany();
    this.escrowId = 1;
    this.notificationId = 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.reset();
  }
}
