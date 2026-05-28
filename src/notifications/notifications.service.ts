import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  EscrowRecord,
  NotificationType,
  PrismaService,
} from '../prisma/prisma.service';
import { SENDGRID_CLIENT, TWILIO_CLIENT } from './notifications.tokens';

interface SendGridClient {
  send(message: Record<string, unknown>): Promise<unknown>;
}

interface TwilioClient {
  messages: {
    create(message: Record<string, unknown>): Promise<{ sid?: string }>;
  };
}

const noopSendGrid: SendGridClient = {
  send: () => Promise.resolve(undefined),
};
const noopTwilio: TwilioClient = {
  messages: { create: () => Promise.resolve({ sid: undefined }) },
};

const MAX_ATTEMPTS = 3;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(SENDGRID_CLIENT)
    private readonly sendGrid: SendGridClient = noopSendGrid,
    @Optional()
    @Inject(TWILIO_CLIENT)
    private readonly twilio: TwilioClient = noopTwilio,
  ) {}

  notifyFunded(escrow: EscrowRecord): Promise<void> {
    return this.dispatch('FUNDED', escrow, escrow.vendorAddress);
  }

  notifyShipped(escrow: EscrowRecord): Promise<void> {
    return this.dispatch('SHIPPED', escrow, escrow.buyerAddress);
  }

  notifyDelivered(escrow: EscrowRecord): Promise<void> {
    return this.dispatch('DELIVERED', escrow, escrow.buyerAddress);
  }

  notifyDisputed(escrow: EscrowRecord): Promise<void> {
    return this.dispatch('DISPUTED', escrow, escrow.vendorAddress);
  }

  notifyDisputedAdmin(escrow: EscrowRecord, adminAddress: string): Promise<void> {
    return this.dispatch('DISPUTED', escrow, adminAddress);
  }

  notifyCompleted(escrow: EscrowRecord): Promise<void> {
    return this.dispatch('COMPLETED', escrow, escrow.buyerAddress);
  }

  notifyRefunded(escrow: EscrowRecord): Promise<void> {
    return this.dispatch('REFUNDED', escrow, escrow.buyerAddress);
  }

  private async dispatch(
    type: NotificationType,
    escrow: EscrowRecord,
    recipientAddress: string,
  ): Promise<void> {
    await this.dispatchEmail(type, escrow, recipientAddress);
    await this.dispatchSms(type, escrow, recipientAddress);
  }

  private async dispatchEmail(
    type: NotificationType,
    escrow: EscrowRecord,
    recipientAddress: string,
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    let providerMessageId: string | null = null;
    let attemptCount = 0;
    let lastResponseCode: number | null = null;

    while (attemptCount < MAX_ATTEMPTS) {
      attemptCount++;
      try {
        this.logger.log(
          `Dispatching SendGrid ${type} [attempt ${attemptCount}/${MAX_ATTEMPTS}, Request-ID: ${requestId}]`,
        );
        const response = await this.sendGrid.send({
          to: recipientAddress,
          templateId: `trustlink-${type.toLowerCase()}`,
          dynamicTemplateData: { escrowId: escrow.id, itemName: escrow.itemName },
          headers: { 'X-Request-ID': requestId },
        });
        providerMessageId = this.extractProviderId(response);
        lastResponseCode = this.extractSuccessCode(response);
        break;
      } catch (error) {
        lastResponseCode = this.extractResponseCode(error);
        if (attemptCount < MAX_ATTEMPTS) {
          const delayMs = 1000 * Math.pow(2, attemptCount - 1);
          this.logger.warn(
            `SendGrid ${type} attempt ${attemptCount}/${MAX_ATTEMPTS} failed ` +
              `(status: ${lastResponseCode ?? 'unknown'}) — retrying in ${delayMs}ms ` +
              `[Request-ID: ${requestId}]`,
          );
          await this.sleep(delayMs);
        } else {
          this.logger.error(
            `SendGrid ${type} notification failed after ${MAX_ATTEMPTS} attempts [Request-ID: ${requestId}]`,
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }

    await this.prisma.notification.create({
      data: {
        escrowId: escrow.id,
        type,
        channel: 'EMAIL',
        recipientAddress,
        providerMessageId,
        attemptCount,
        lastResponseCode,
      },
    });
  }

  private async dispatchSms(
    type: NotificationType,
    escrow: EscrowRecord,
    recipientAddress: string,
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    let providerMessageId: string | null = null;
    let attemptCount = 0;
    let lastResponseCode: number | null = null;

    while (attemptCount < MAX_ATTEMPTS) {
      attemptCount++;
      try {
        this.logger.log(
          `Dispatching Twilio ${type} [attempt ${attemptCount}/${MAX_ATTEMPTS}, Request-ID: ${requestId}]`,
        );
        const response = await this.twilio.messages.create({
          to: recipientAddress,
          body: `${type}: ${escrow.itemName}`,
        });
        providerMessageId = response.sid ?? null;
        break;
      } catch (error) {
        lastResponseCode = this.extractResponseCode(error);
        if (attemptCount < MAX_ATTEMPTS) {
          const delayMs = 1000 * Math.pow(2, attemptCount - 1);
          this.logger.warn(
            `Twilio ${type} attempt ${attemptCount}/${MAX_ATTEMPTS} failed ` +
              `(status: ${lastResponseCode ?? 'unknown'}) — retrying in ${delayMs}ms ` +
              `[Request-ID: ${requestId}]`,
          );
          await this.sleep(delayMs);
        } else {
          this.logger.error(
            `Twilio ${type} notification failed after ${MAX_ATTEMPTS} attempts [Request-ID: ${requestId}]`,
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }

    await this.prisma.notification.create({
      data: {
        escrowId: escrow.id,
        type,
        channel: 'SMS',
        recipientAddress,
        providerMessageId,
        attemptCount,
        lastResponseCode,
      },
    });
  }

  /** Resolves after `ms` milliseconds. Extracted for test spying. */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractProviderId(response: unknown): string | null {
    if (
      Array.isArray(response) &&
      typeof response[0] === 'object' &&
      response[0] !== null &&
      'headers' in response[0]
    ) {
      const headers = (response[0] as { headers?: Record<string, string> })
        .headers;
      return headers?.['x-message-id'] ?? null;
    }
    return null;
  }

  private extractSuccessCode(response: unknown): number | null {
    if (Array.isArray(response) && typeof response[0] === 'object' && response[0] !== null) {
      const r = response[0] as Record<string, unknown>;
      if (typeof r.statusCode === 'number') return r.statusCode;
    }
    return null;
  }

  private extractResponseCode(error: unknown): number | null {
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      if (typeof e.code === 'number') return e.code;
      if (typeof e.status === 'number') return e.status;
      const res = e.response;
      if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        if (typeof r.statusCode === 'number') return r.statusCode;
        if (typeof r.status === 'number') return r.status;
      }
    }
    return null;
  }
}
