import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import Redis from 'ioredis';

/**
 * Issue #103 – Thin Redis wrapper used for response caching.
 *
 * When REDIS_URL is not configured the service operates as a no-op so
 * development and test environments work without a Redis instance.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis | null;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get('REDIS_URL');
    if (redisUrl) {
      this.client = new Redis(redisUrl, { lazyConnect: true });
      this.client.on('error', (err: Error) =>
        this.logger.error('Redis connection error', err.message),
      );
      this.client.connect().catch((err: Error) =>
        this.logger.error('Redis connect failed', err.message),
      );
    } else {
      this.client = null;
      this.logger.warn('REDIS_URL not set — response caching disabled');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err: unknown) {
      this.logger.error(`cache.get failed for key ${key}`, (err as Error).message);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err: unknown) {
      this.logger.error(`cache.set failed for key ${key}`, (err as Error).message);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err: unknown) {
      this.logger.error(`cache.del failed for key ${key}`, (err as Error).message);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
