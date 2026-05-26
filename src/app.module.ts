import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EscrowModule } from './escrow/escrow.module';
import { PrismaModule } from './prisma/prisma.module';
import { StellarModule } from './stellar/stellar.module';

@Module({
  imports: [PrismaModule, EscrowModule, StellarModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
