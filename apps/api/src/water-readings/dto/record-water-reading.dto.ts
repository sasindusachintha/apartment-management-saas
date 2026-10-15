import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RecordWaterReadingDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Building ID' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiProperty({ description: 'Apartment ID' })
  @IsString()
  @IsNotEmpty()
  apartmentId!: string;

  @ApiProperty({ description: 'Period code (e.g. 2026-10)', example: '2026-10' })
  @IsString()
  @IsNotEmpty()
  periodCode!: string;

  @ApiPropertyOptional({ description: 'Billing Period ID' })
  @IsString()
  @IsOptional()
  billingPeriodId?: string;

  @ApiProperty({ description: 'Previous meter reading', example: 120.0 })
  @IsNumber()
  @Min(0)
  previousReading!: number;

  @ApiProperty({ description: 'Current meter reading', example: 125.0 })
  @IsNumber()
  @Min(0)
  currentReading!: number;

  @ApiPropertyOptional({ description: 'Rate per unit. If omitted, uses building settings tariff.', example: 100.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ratePerUnit?: number;

  @ApiPropertyOptional({ description: 'Fixed service charge. If omitted, uses building settings charge.', example: 0.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  fixedCharge?: number;

  @ApiPropertyOptional({ description: 'Allow negative consumption as an authorized correction', default: false })
  @IsBoolean()
  @IsOptional()
  allowCorrection?: boolean = false;

  @ApiPropertyOptional({ description: 'Meter reading date' })
  @IsDateString()
  @IsOptional()
  readingDate?: string;

  @ApiPropertyOptional({ description: 'Notes or remarks' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkWaterReadingItemDto {
  @ApiProperty({ description: 'Apartment ID' })
  @IsString()
  @IsNotEmpty()
  apartmentId!: string;

  @ApiProperty({ description: 'Previous meter reading' })
  @IsNumber()
  @Min(0)
  previousReading!: number;

  @ApiProperty({ description: 'Current meter reading' })
  @IsNumber()
  @Min(0)
  currentReading!: number;

  @ApiPropertyOptional({ description: 'Allow negative consumption as authorized correction' })
  @IsBoolean()
  @IsOptional()
  allowCorrection?: boolean;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkWaterReadingDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Building ID' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiProperty({ description: 'Period code (e.g. 2026-10)', example: '2026-10' })
  @IsString()
  @IsNotEmpty()
  periodCode!: string;

  @ApiProperty({ type: [BulkWaterReadingItemDto] })
  readings!: BulkWaterReadingItemDto[];
}
