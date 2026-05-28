import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CreateVendorProfileDto } from './dto/create-vendor-profile.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorProfileService } from './vendor-profile.service';

@Controller('vendor/profile')
@UseGuards(JwtGuard)
export class VendorProfileController {
  constructor(private readonly vendorProfileService: VendorProfileService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateVendorProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendorProfileService.createProfile(user.address, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.vendorProfileService.getProfile(user.address);
  }

  @Patch()
  update(
    @Body() dto: UpdateVendorProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendorProfileService.updateProfile(user.address, dto);
  }
}
