import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { RoomType } from '@prisma/client';

export class CreateRoomDto {
  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Building ID' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiProperty({ description: 'Apartment ID' })
  @IsString()
  @IsNotEmpty()
  apartmentId!: string;

  @ApiProperty({ description: 'Room Name or Number (e.g. Master Bedroom, Bedroom 1, Room 101-A)', example: 'Bedroom 1' })
  @IsString()
  @IsNotEmpty()
  roomNumber!: string;

  @ApiProperty({ enum: RoomType, default: RoomType.BEDROOM })
  @IsEnum(RoomType)
  roomType!: RoomType;

  @ApiProperty({ description: 'Area in square feet', example: 150.0 })
  @IsNumber()
  @IsPositive()
  areaSqft!: number;

  @ApiPropertyOptional({
    description: 'Specific maintenance rate for this room (Rs./sqft). If omitted or null, uses default apartment/building rate.',
    example: 10.0,
  })
  @IsNumber()
  @IsOptional()
  maintenanceRate?: number | null;

  @ApiPropertyOptional({ description: 'Notes or description' })
  @IsString()
  @IsOptional()
  notes?: string | null;
}

export class UpdateRoomDto {
  @ApiPropertyOptional({ description: 'Room Name or Number', example: 'Bedroom 1' })
  @IsString()
  @IsOptional()
  roomNumber?: string;

  @ApiPropertyOptional({ enum: RoomType })
  @IsEnum(RoomType)
  @IsOptional()
  roomType?: RoomType;

  @ApiPropertyOptional({ description: 'Area in square feet', example: 150.0 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  areaSqft?: number;

  @ApiPropertyOptional({ description: 'Maintenance rate (Rs./sqft)' })
  @IsNumber()
  @IsOptional()
  maintenanceRate?: number | null;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string | null;
}
