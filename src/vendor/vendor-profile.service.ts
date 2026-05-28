import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VendorProfileRecord } from '../prisma/prisma.service';
import { CreateVendorProfileDto } from './dto/create-vendor-profile.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorProfileRepository } from './vendor-profile.repository';

@Injectable()
export class VendorProfileService {
  constructor(private readonly repository: VendorProfileRepository) {}

  async createProfile(
    address: string,
    dto: CreateVendorProfileDto,
  ): Promise<VendorProfileRecord> {
    const existing = await this.repository.findByAddress(address);
    if (existing) {
      throw new ConflictException('Vendor profile already exists');
    }
    return this.repository.create(address, dto);
  }

  async getProfile(address: string): Promise<VendorProfileRecord> {
    const profile = await this.repository.findByAddress(address);
    if (!profile) {
      throw new NotFoundException('Vendor profile not found');
    }
    return profile;
  }

  async updateProfile(
    address: string,
    dto: UpdateVendorProfileDto,
  ): Promise<VendorProfileRecord> {
    const keys = Object.keys(dto).filter(
      (k) => (dto as Record<string, unknown>)[k] !== undefined,
    );
    if (keys.length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    const existing = await this.repository.findByAddress(address);
    if (!existing) {
      throw new NotFoundException('Vendor profile not found');
    }
    return this.repository.update(address, dto);
  }
}
