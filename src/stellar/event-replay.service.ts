import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '../config/config.service';
import { StellarWebhookService } from '../webhooks/stellar-webhook.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EventReplayService implements OnModuleInit {
  private readonly logger = new Logger(EventReplayService.name);
  private readonly cursorFile = path.resolve(
    process.cwd(),
    'data',
    'stellar_cursor.txt',
  );

  constructor(
    private readonly config: ConfigService,
    private readonly webhookService: StellarWebhookService,
  ) {}

  /** Replays recent Horizon operations from the persisted cursor on startup. */
  async onModuleInit(): Promise<void> {
    try {
      const network = this.config.get('STELLAR_NETWORK') || 'TESTNET';
      const horizon =
        network === 'MAINNET'
          ? 'https://horizon.stellar.org'
          : 'https://horizon-testnet.stellar.org';

      let cursor: string | undefined = undefined;
      if (fs.existsSync(this.cursorFile)) {
        cursor = fs.readFileSync(this.cursorFile, 'utf8').trim();
        if (!cursor) cursor = undefined;
      }

      const url = `${horizon}/operations?order=asc&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      this.logger.log(`EventReplay fetching operations from ${url}`);
      const res = await axios.get(url, { timeout: 15000 });
      const records = res.data._embedded?.records ?? [];

      for (const rec of records) {
        // Map operation to webhook DTO minimal shape
        const dto: any = {
          id: String(rec.id),
          type: rec.type,
          to: rec.to,
          amount: rec.amount,
          asset_code: rec.asset_code,
          transaction_hash: rec.transaction_hash,
        };

        try {
          await this.webhookService.processOperationDto(dto);
        } catch (err) {
          this.logger.error('Failed to process replayed op', err);
        }

        // persist last processed id
        try {
          fs.mkdirSync(path.dirname(this.cursorFile), { recursive: true });
          fs.writeFileSync(this.cursorFile, String(rec.paging_token || rec.id));
        } catch (err) {
          this.logger.warn('Failed to persist cursor file: ' + err.message);
        }
      }

      this.logger.log(`Event replay processed ${records.length} operations`);
    } catch (err) {
      this.logger.warn(
        'Event replay failed: ' +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }
}
