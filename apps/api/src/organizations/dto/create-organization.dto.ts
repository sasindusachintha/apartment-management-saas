import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Property Management' })
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'acme-properties' })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and hyphens',
  })
  @MinLength(2)
  @MaxLength(60)
  slug!: string;
}
