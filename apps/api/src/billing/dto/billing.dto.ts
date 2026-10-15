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
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdjustmentType, InvoiceItemType } from '@prisma/client';

export class SaveBillingSettingDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiPropertyOptional({ description: 'Building ID (null for org-wide default)' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiProperty({ description: 'Maintenance rate per square foot (Rs./sqft)', example: 10.0 })
  @IsNumber()
  @IsPositive()
  maintenanceRatePerSqft!: number;

  @ApiPropertyOptional({ description: 'Default due days from invoice issue', default: 15 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  defaultDueDays?: number = 15;

  @ApiPropertyOptional({ description: 'Late payment penalty percentage', default: 0.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  latePaymentPenaltyPercent?: number = 0.0;

  @ApiPropertyOptional({ description: 'Late payment grace period in days', default: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  latePaymentGraceDays?: number = 5;

  @ApiPropertyOptional({ description: 'Water tariff rate per unit (m3/unit)', default: 100.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  waterTariffPerUnit?: number = 100.0;

  @ApiPropertyOptional({ description: 'Fixed water service charge', default: 0.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  waterFixedCharge?: number = 0.0;

  @ApiPropertyOptional({ description: 'Bank Name', example: 'Commercial Bank of Ceylon' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ description: 'Account Name', example: 'Management Corporation - Span Tower IX' })
  @IsString()
  @IsOptional()
  bankAccountName?: string;

  @ApiPropertyOptional({ description: 'Bank Account Number', example: '100045678901' })
  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ description: 'Bank Branch', example: 'Wellawatte Branch' })
  @IsString()
  @IsOptional()
  bankBranch?: string;

  @ApiPropertyOptional({ description: 'Payment Instructions' })
  @IsString()
  @IsOptional()
  paymentInstructions?: string;

  @ApiPropertyOptional({ description: 'Remittance Contact Email', example: 'span.ebenezer@gmail.com' })
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Remittance Contact Phone / WhatsApp', example: '+94 770201034' })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Remittance Contact Person', example: 'Mr. Tony David' })
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Special resolution or penalty notice text' })
  @IsString()
  @IsOptional()
  noticeText?: string;
}

export class CreateBillingPeriodDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Building ID' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiProperty({ description: 'Period name (e.g. October 2026)', example: 'October 2026' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Period code (YYYY-MM)', example: '2026-10' })
  @IsString()
  @IsNotEmpty()
  periodCode!: string;

  @ApiProperty({ description: 'Start date of the billing period' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date of the billing period' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ description: 'Due date for invoice payments' })
  @IsDateString()
  dueDate!: string;
}

export class AdditionalChargeItemDto {
  @ApiProperty({ enum: InvoiceItemType, default: InvoiceItemType.OTHER })
  @IsEnum(InvoiceItemType)
  itemType!: InvoiceItemType;

  @ApiProperty({ description: 'Charge description (e.g. Generator Fuel, Common Area Repair)' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ description: 'Quantity', default: 1 })
  @IsNumber()
  @IsOptional()
  quantity?: number = 1;

  @ApiProperty({ description: 'Unit rate or amount' })
  @IsNumber()
  unitRate!: number;

  @ApiProperty({ description: 'Line amount' })
  @IsNumber()
  amount!: number;
}

export class GenerateInvoiceDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Building ID' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiProperty({ description: 'Apartment ID' })
  @IsString()
  @IsNotEmpty()
  apartmentId!: string;

  @ApiProperty({ description: 'Billing Period Code (e.g. 2026-10)', example: '2026-10' })
  @IsString()
  @IsNotEmpty()
  periodCode!: string;

  @ApiPropertyOptional({ description: 'Custom due date override' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Custom maintenance rate override' })
  @IsNumber()
  @IsOptional()
  maintenanceRateOverride?: number;

  @ApiPropertyOptional({ description: 'Include recorded water reading', default: true })
  @IsBoolean()
  @IsOptional()
  includeWater?: boolean = true;

  @ApiPropertyOptional({ type: [AdditionalChargeItemDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdditionalChargeItemDto)
  additionalCharges?: AdditionalChargeItemDto[] = [];

  @ApiPropertyOptional({ description: 'Late penalty amount if any', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  penaltyAmount?: number = 0;

  @ApiPropertyOptional({ description: 'Discount amount if any', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number = 0;

  @ApiPropertyOptional({ description: 'Bill notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Auto-finalize upon generation', default: false })
  @IsBoolean()
  @IsOptional()
  finalize?: boolean = false;
}

export class BulkGenerateInvoicesDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'Building ID' })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiProperty({ description: 'Billing Period Code (e.g. 2026-10)', example: '2026-10' })
  @IsString()
  @IsNotEmpty()
  periodCode!: string;

  @ApiPropertyOptional({ description: 'Custom due date override' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Include water charges from meter readings', default: true })
  @IsBoolean()
  @IsOptional()
  includeWater?: boolean = true;

  @ApiPropertyOptional({ type: [AdditionalChargeItemDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdditionalChargeItemDto)
  commonCharges?: AdditionalChargeItemDto[] = [];

  @ApiPropertyOptional({ description: 'Auto-finalize bills immediately', default: false })
  @IsBoolean()
  @IsOptional()
  finalize?: boolean = false;
}

export class FinalizeInvoicesDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({ description: 'List of Invoice IDs to finalize' })
  @IsArray()
  @IsString({ each: true })
  invoiceIds!: string[];
}

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({ enum: AdjustmentType, description: 'CREDIT, DEBIT, WAIVER, CORRECTION' })
  @IsEnum(AdjustmentType)
  adjustmentType!: AdjustmentType;

  @ApiProperty({ description: 'Adjustment amount (positive number)' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'Reason for adjustment (required for financial auditability)' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
