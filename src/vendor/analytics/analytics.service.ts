import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChartDataResponse, DailyVolumeData } from './analytics.dto';
import {
  AnalyticsStatsResponse,
  TransactionStats,
  ChannelMetrics,
} from './analytics-stats.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves daily transaction volume data for a vendor.
   * Uses composite indexes on (vendorAddress, createdAt) for optimal query performance.
   * Returns time-series data grouped by date with aggregated metrics.
   */
  async getDailyVolumeChart(
    vendorAddress: string,
    days: number = 30,
  ): Promise<ChartDataResponse> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query escrows for the vendor within the date range
    // Uses index on (vendorAddress, createdAt) for efficient filtering
    const escrows = await this.prisma.escrow.findMany({
      where: {
        vendorAddress,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        amount: true,
        state: true,
        createdAt: true,
      },
    });

    // Group escrows by date and calculate aggregations
    const dailyMap = new Map<string, DailyVolumeData>();

    for (const escrow of escrows) {
      const dateKey = this.formatDate(escrow.createdAt);

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          totalVolume: 0,
          transactionCount: 0,
          completedCount: 0,
          disputedCount: 0,
          averageTransactionValue: 0,
        });
      }

      const daily = dailyMap.get(dateKey)!;
      const amount = Number(escrow.amount);

      daily.totalVolume += amount;
      daily.transactionCount += 1;

      if (escrow.state === 'COMPLETED' || escrow.state === 'RELEASED') {
        daily.completedCount += 1;
      }

      if (escrow.state === 'DISPUTED') {
        daily.disputedCount += 1;
      }
    }

    // Calculate average transaction values
    dailyMap.forEach((daily) => {
      daily.averageTransactionValue =
        daily.transactionCount > 0
          ? daily.totalVolume / daily.transactionCount
          : 0;
    });

    // Sort by date ascending
    const sortedData = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Calculate summary statistics
    const totalVolume = sortedData.reduce((sum, d) => sum + d.totalVolume, 0);
    const totalTransactions = sortedData.reduce(
      (sum, d) => sum + d.transactionCount,
      0,
    );
    const averageDaily =
      sortedData.length > 0 ? totalVolume / sortedData.length : 0;

    return {
      data: sortedData,
      period: {
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
      },
      summary: {
        totalVolume,
        totalTransactions,
        averageDaily,
      },
    };
  }

  /**
   * Retrieves overall transaction statistics for a vendor.
   * Uses fast query paths with composite indexes on (vendorAddress, state).
   * Includes conversion metrics and channel preferences.
   */
  async getTransactionStats(
    vendorAddress: string,
  ): Promise<AnalyticsStatsResponse> {
    // Query all escrows for the vendor, grouped by state
    // Uses index on (vendorAddress, state) for fast filtering
    const escrows = await this.prisma.escrow.findMany({
      where: {
        vendorAddress,
      },
      select: {
        id: true,
        amount: true,
        state: true,
      },
    });

    // Calculate transaction statistics
    const stats: TransactionStats = {
      totalVolume: 0,
      activeVolume: 0,
      totalTransactions: escrows.length,
      activeTransactions: 0,
      completedTransactions: 0,
      completionRate: 0,
      disputedTransactions: 0,
      disputeRate: 0,
      averageTransactionValue: 0,
      cancelledTransactions: 0,
    };

    // Active states: CREATED, FUNDED, SHIPPED, DELIVERED
    const activeStates = ['CREATED', 'FUNDED', 'SHIPPED', 'DELIVERED'];

    for (const escrow of escrows) {
      const amount = Number(escrow.amount);
      stats.totalVolume += amount;

      if (activeStates.includes(escrow.state)) {
        stats.activeVolume += amount;
        stats.activeTransactions += 1;
      }

      if (escrow.state === 'COMPLETED' || escrow.state === 'RELEASED') {
        stats.completedTransactions += 1;
      }

      if (escrow.state === 'DISPUTED') {
        stats.disputedTransactions += 1;
      }

      if (escrow.state === 'CANCELLED') {
        stats.cancelledTransactions += 1;
      }
    }

    // Calculate rates
    if (stats.totalTransactions > 0) {
      stats.completionRate =
        (stats.completedTransactions / stats.totalTransactions) * 100;
      stats.disputeRate =
        (stats.disputedTransactions / stats.totalTransactions) * 100;
      stats.averageTransactionValue =
        stats.totalVolume / stats.totalTransactions;
    }

    // Fetch vendor tracking settings for channel preferences
    const trackingSettings =
      await this.prisma.vendorTrackingSettings.findUnique({
        where: { vendorAddress },
        select: {
          notificationChannels: true,
        },
      });

    const channels: ChannelMetrics = {
      email: {
        notificationsEnabled:
          trackingSettings?.notificationChannels?.includes('EMAIL') ?? false,
      },
      sms: {
        notificationsEnabled:
          trackingSettings?.notificationChannels?.includes('SMS') ?? false,
      },
    };

    return {
      stats,
      channels,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Formats a Date object to ISO date string (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
