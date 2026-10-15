import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApartmentStatus } from '@prisma/client';

export class CreateApartmentDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Building ID' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiPropertyOptional({ description: 'Tower / Block ID (optional for single tower complexes)' })
  @IsString()
  @IsOptional()
  towerId?: string;

  @ApiProperty({ description: 'Apartment / Unit number (e.g. 4B, 101)', example: '4B' })
  @IsString()
  @IsNotEmpty()
  unitNumber!: string;

  @ApiPropertyOptional({ description: 'Floor number', default: 1 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  floor?: number = 1;

  @ApiProperty({ description: 'Square footage area', example: 1000.0 })
  @IsNumber()
  @IsPositive()
  areaSqft!: number;

  @ApiPropertyOptional({ enum: ApartmentStatus, default: ApartmentStatus.ACTIVE })
  @IsEnum(ApartmentStatus)
  @IsOptional()
  status?: ApartmentStatus = ApartmentStatus.ACTIVE;

  @ApiPropertyOptional({ description: 'Owner User ID if user account exists' })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Resident User ID if user account exists' })
  @IsString()
  @IsOptional()
  residentId?: string;

  @ApiPropertyOptional({ description: 'Owner full name', example: 'Mr. R. Wickramasinghe' })
  @IsString()
  @IsOptional()
  ownerName?: string;

  @ApiPropertyOptional({ description: 'Owner email address' })
  @IsString()
  @IsOptional()
  ownerEmail?: string;

  @ApiPropertyOptional({ description: 'Owner contact phone number' })
  @IsString()
  @IsOptional()
  ownerPhone?: string;

  @ApiPropertyOptional({ description: 'Resident / Tenant full name', example: 'Mr. R. Wickramasinghe' })
  @IsString()
  @IsOptional()
  residentName?: string;

  @ApiPropertyOptional({ description: 'Resident email address' })
  @IsString()
  @IsOptional()
  residentEmail?: string;

  @ApiPropertyOptional({ description: 'Resident contact phone number' })
  @IsString()
  @IsOptional()
  residentPhone?: string;

  @ApiPropertyOptional({ description: 'Additional notes or remarks' })
  @IsString()
  @IsOptional()
  notes?: string;
}
