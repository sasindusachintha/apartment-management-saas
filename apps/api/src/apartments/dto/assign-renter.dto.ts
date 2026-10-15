import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignRenterDto {
  @ApiProperty({ example: 'Mr. Tony David' })
  @IsString()
  @IsNotEmpty({ message: 'Resident name is required' })
  residentName!: string;

  @ApiPropertyOptional({ example: 'renter@example.com' })
  @IsOptional()
  @IsString()
  residentEmail?: string;

  @ApiPropertyOptional({ example: '+94 77 020 1034' })
  @IsOptional()
  @IsString()
  residentPhone?: string;

  @ApiPropertyOptional({ example: 'cuid-user-id' })
  @IsOptional()
  @IsString()
  residentId?: string;

  @ApiPropertyOptional({ example: '12-month standard lease' })
  @IsOptional()
  @IsString()
  notes?: string;
}
