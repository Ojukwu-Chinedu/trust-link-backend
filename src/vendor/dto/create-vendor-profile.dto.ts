import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateVendorProfileDto {
  @IsString()
  @MinLength(2, { message: 'Business name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Business name must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  businessName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Must be a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone must not exceed 20 characters' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}
