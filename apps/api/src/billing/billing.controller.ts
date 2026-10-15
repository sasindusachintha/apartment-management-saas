import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import {
  BulkGenerateInvoicesDto,
  CreateAdjustmentDto,
  CreateBillingPeriodDto,
  FinalizeInvoicesDto,
  GenerateInvoiceDto,
  SaveBillingSettingDto,
} from './dto/billing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ─── Settings ──────────────────────────────────────────
  @Get('settings/:buildingId')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Get billing settings for a building' })
  getSetting(@Param('buildingId') buildingId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getSetting(buildingId, user);
  }

  @Post('settings')
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Save or update billing settings' })
  saveSetting(@Body() dto: SaveBillingSettingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.saveSetting(dto, user);
  }

  // ─── Periods ───────────────────────────────────────────
  @Get('periods')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'List billing periods' })
  @ApiQuery({ name: 'buildingId', required: false })
  findAllPeriods(@CurrentUser() user: AuthenticatedUser, @Query('buildingId') buildingId?: string) {
    return this.billingService.findAllPeriods(user, buildingId);
  }

  @Post('periods')
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new billing period' })
  createPeriod(@Body() dto: CreateBillingPeriodDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.createPeriod(dto, user);
  }

  // ─── Invoices ──────────────────────────────────────────
  @Get('invoices')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'List apartment invoices' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'periodCode', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAllInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('apartmentId') apartmentId?: string,
    @Query('periodCode') periodCode?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.billingService.findAllInvoices(user, {
      organizationId,
      buildingId,
      apartmentId,
      periodCode,
      status,
      search,
    });
  }

  @Get('invoices/:id')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Get invoice details by ID' })
  findOneInvoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.findOneInvoice(id, user);
  }

  @Get('invoices/:id/pdf')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Download or view invoice PDF' })
  async getInvoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.billingService.getPdfBuffer(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${id}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post('invoices/generate')
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate monthly invoice for an apartment' })
  generateInvoice(@Body() dto: GenerateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.generateInvoice(dto, user);
  }

  @Post('invoices/bulk-generate')
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk generate invoices for an entire building' })
  bulkGenerate(@Body() dto: BulkGenerateInvoicesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.bulkGenerateInvoices(dto, user);
  }

  @Post('invoices/finalize')
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Review and finalize draft invoices' })
  finalize(@Body() dto: FinalizeInvoicesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.finalizeInvoices(dto, user);
  }

  @Post('invoices/adjust')
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Apply auditable financial adjustment to an invoice' })
  adjust(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.createAdjustment(dto, user);
  }
}
