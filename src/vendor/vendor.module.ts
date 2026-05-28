import { Module } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { VendorProfileController } from './vendor-profile.controller';
import { VendorProfileRepository } from './vendor-profile.repository';
import { VendorProfileService } from './vendor-profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [VendorProfileController],
  providers: [VendorProfileService, VendorProfileRepository, JwtGuard],
  exports: [VendorProfileService],
})
export class VendorModule {}
