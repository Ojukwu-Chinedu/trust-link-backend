import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { STELLAR_SERVER } from './stellar.tokens';

@Module({
  providers: [
    ContractService,
    { provide: STELLAR_SERVER, useValue: undefined },
  ],
  exports: [ContractService],
})
export class StellarModule {}
