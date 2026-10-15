import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BuildingStatus } from '@prisma/client';

export class UpdateBuildingDto {
  @ApiPropertyOptional({ example: 'Sunset Heights Apartments West' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '102 Sunset Boulevard, Metropolis' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ enum: BuildingStatus, example: 'ACTIVE' })
  @IsOptional()
  @IsEnum(BuildingStatus)
  status?: BuildingStatus;
}
