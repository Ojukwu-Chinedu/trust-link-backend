import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class HorizonService {
  private readonly horizonUrl = 'https://horizon-testnet.stellar.org';
  private readonly pollIntervalMs = 100;

  async pollConfirmation(
    transactionHash: string,
    targetConfirmations = 3,
    timeoutMs = 10000,
  ): Promise<{ confirmed: boolean; confirmations: number; hash: string }> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const response = await axios.get(
          `${this.horizonUrl}/transactions/${encodeURIComponent(
            transactionHash,
          )}`,
        );

        if (response.status !== 200) {
          throw new Error(`Horizon responded with ${response.status}`);
        }

        const confirmations = Number(response.data?.confirmations ?? 0);
        if (confirmations >= targetConfirmations) {
          return {
            confirmed: true,
            confirmations,
            hash: transactionHash,
          };
        }
      } catch (error) {
        if (Date.now() - start >= timeoutMs) {
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new Error('Horizon confirmation timed out');
  }
}
