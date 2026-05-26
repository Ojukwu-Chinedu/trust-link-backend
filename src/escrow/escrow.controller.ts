import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { EscrowService } from './escrow.service';

@Controller('escrow')
@UseGuards(JwtGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  createEscrow(@Body() dto: CreateEscrowDto, @CurrentUser() user: AuthUser) {
    return this.escrowService.createEscrow(dto, user.address);
  }

  @Get(':id')
  getEscrow(@Param('id') id: string) {
    return this.escrowService.findById(id);
  }
}
