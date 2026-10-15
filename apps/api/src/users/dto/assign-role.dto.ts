import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'MANAGER' })
  @IsString()
  @IsNotEmpty({ message: 'Role name or role ID is required' })
  roleName!: string;

  @ApiPropertyOptional({ example: 'clorg00000000000000000000' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ example: 'clbld00000000000000000000' })
  @IsOptional()
  @IsString()
  buildingId?: string;
}
