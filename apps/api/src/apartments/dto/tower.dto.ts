import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateTowerDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Building (Complex) ID' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiProperty({ description: 'Tower or Block Name (e.g. Tower A, Block B)', example: 'Tower A' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Short code (e.g. A, B, T1)', example: 'A' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Total floors in this tower', default: 1 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  totalFloors?: number = 1;

  @ApiPropertyOptional({ description: 'Description or notes' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTowerDto {
  @ApiPropertyOptional({ description: 'Tower or Block Name', example: 'Tower A' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Short code', example: 'A' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Total floors' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  totalFloors?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
