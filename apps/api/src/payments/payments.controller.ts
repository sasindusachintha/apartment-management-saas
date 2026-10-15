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
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Payments & Arrears')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'List payment records' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'apartmentId', required: false })
  @ApiQuery({ name: 'paymentMethod', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('apartmentId') apartmentId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('search') search?: string,
  ) {
    return this.paymentsService.findAll(user, {
      organizationId,
      buildingId,
      apartmentId,
      paymentMethod,
      search,
    });
  }

  @Get('arrears-summary')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'Get outstanding arrears summary and collection stats' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  getArrearsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.paymentsService.getArrearsSummary(user, {
      organizationId,
      buildingId,
    });
  }

  @Get(':id')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'Get payment record by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findOne(id, user);
  }

  @Get(':id/receipt')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'Download or print payment receipt PDF' })
  async getReceiptPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.paymentsService.getPdfBuffer(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${id}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @RequirePermissions('payments.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record payment and allocate to outstanding invoices' })
  record(@Body() dto: RecordPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.recordPayment(dto, user);
  }
}
