import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail({}, { message: 'A valid email is required' })
  email!: string;

  @ApiPropertyOptional({ example: '+1-555-0199' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'InitialSecurePass123!' })
  @IsString()
  @IsNotEmpty({ message: 'Initial password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @ApiPropertyOptional({ example: 'BUILDING_OWNER' })
  @IsOptional()
  @IsString()
  initialRole?: string;

  @ApiPropertyOptional({ example: 'clorg00000000000000000000' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ example: 'clbld00000000000000000000' })
  @IsOptional()
  @IsString()
  buildingId?: string;
}
