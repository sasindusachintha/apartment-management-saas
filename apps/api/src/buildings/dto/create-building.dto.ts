import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BuildingStatus } from '@prisma/client';

export class CreateBuildingDto {
  @ApiProperty({ example: 'clorg00000000000000000000' })
  @IsString()
  @IsNotEmpty({ message: 'organizationId is required' })
  organizationId!: string;

  @ApiProperty({ example: 'Sunset Heights Apartments' })
  @IsString()
  @IsNotEmpty({ message: 'Building name is required' })
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '100 Sunset Boulevard, Metropolis' })
  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  @MinLength(5)
  @MaxLength(255)
  address!: string;

  @ApiPropertyOptional({ enum: BuildingStatus, example: 'ACTIVE' })
  @IsOptional()
  @IsEnum(BuildingStatus)
  status?: BuildingStatus;
}
