import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export enum DisputeReasonCategory {
  ITEM_NOT_AS_DESCRIBED = 'ITEM_NOT_AS_DESCRIBED',
  ITEM_NOT_RECEIVED = 'ITEM_NOT_RECEIVED',
  DAMAGED_ITEM = 'DAMAGED_ITEM',
  FRAUD = 'FRAUD',
  OTHER = 'OTHER',
}

export class OpenDisputeDto {
  @IsEnum(DisputeReasonCategory)
  reason!: DisputeReasonCategory;

  @IsString()
  @MinLength(20, { message: 'Description must be at least 20 characters' })
  description!: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  evidenceUrls?: string[];
}
