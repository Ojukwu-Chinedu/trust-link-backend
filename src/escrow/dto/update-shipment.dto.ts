import { IsString, MinLength } from 'class-validator';

export class UpdateShipmentDto {
  @IsString()
  @MinLength(1)
  trackingId!: string;
}
