import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApartmentStatus } from '@prisma/client';

export class UpdateApartmentDto {
  @ApiPropertyOptional({ description: 'Tower / Block ID' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  towerId?: string | null;

  @ApiPropertyOptional({ description: 'Apartment / Unit number (e.g. 4B, 101)', example: '4B' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  unitNumber?: string;

  @ApiPropertyOptional({ description: 'Floor number' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ description: 'Square footage area', example: 1000.0 })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  areaSqft?: number;

  @ApiPropertyOptional({ description: 'Number of rooms', example: 2 })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1)
  @IsOptional()
  roomCount?: number;

  @ApiPropertyOptional({ enum: ApartmentStatus })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsEnum(ApartmentStatus)
  @IsOptional()
  status?: ApartmentStatus;

  @ApiPropertyOptional({ description: 'Owner User ID' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  ownerId?: string | null;

  @ApiPropertyOptional({ description: 'Resident User ID' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  residentId?: string | null;

  @ApiPropertyOptional({ description: 'Owner full name' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  ownerName?: string | null;

  @ApiPropertyOptional({ description: 'Owner email address' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  ownerEmail?: string | null;

  @ApiPropertyOptional({ description: 'Owner contact phone number' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  ownerPhone?: string | null;

  @ApiPropertyOptional({ description: 'Resident full name' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  residentName?: string | null;

  @ApiPropertyOptional({ description: 'Resident email address' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  residentEmail?: string | null;

  @ApiPropertyOptional({ description: 'Resident contact phone number' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  residentPhone?: string | null;

  @ApiPropertyOptional({ description: 'Additional notes or remarks' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Is active flag' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
