import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@apartmentsaas.com' })
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;
}
