import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class InvoiceAllocationItemDto {
  @ApiProperty({ description: 'Invoice ID to allocate payment to' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({ description: 'Amount to allocate to this invoice', example: 2000.0 })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class RecordPaymentDto {
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

  @ApiProperty({ description: 'Payment amount in Sri Lankan Rupees (Rs.)', example: 2000.0 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ description: 'Payment reference (Cheque no, Bank transfer ref, etc.)', example: 'TXN-998822' })
  @IsString()
  @IsNotEmpty()
  paymentReference!: string;

  @ApiPropertyOptional({ description: 'Payment date (defaults to current date)' })
  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Notes or remarks' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Flag indicating online payment' })
  @IsBoolean()
  @IsOptional()
  isOnline?: boolean = false;

  @ApiPropertyOptional({
    type: [InvoiceAllocationItemDto],
    description: 'Optional explicit invoice allocations. If omitted, payment is allocated FIFO to oldest dues.',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InvoiceAllocationItemDto)
  allocations?: InvoiceAllocationItemDto[];
}
