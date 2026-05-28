import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../auth/guards/jwt.guard';
import { AdminGuard } from '../guards/admin.guard';
import { AdminStatsService } from './admin-stats.service';

@Controller('admin/stats')
@UseGuards(JwtGuard, AdminGuard)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get()
  getStats() {
    return this.adminStatsService.getStats();
  }
}
