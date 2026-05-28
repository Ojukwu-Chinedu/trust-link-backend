export class AdminStatsDto {
  totalEscrows!: number;
  totalVolume!: number;
  escrowsByState!: Record<string, number>;
  uniqueVendors!: number;
  uniqueBuyers!: number;
  totalDisputes!: number;
  openDisputes!: number;
  averageEscrowAmount!: number;
}
