import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('collection')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Monthly collection report' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'periodCode', required: false })
  getCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('periodCode') periodCode?: string,
  ) {
    return this.reportsService.getCollectionReport(user, {
      organizationId,
      buildingId,
      periodCode,
    });
  }

  @Get('arrears')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Outstanding arrears report across apartments' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  getArrears(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.reportsService.getArrearsReport(user, {
      organizationId,
      buildingId,
    });
  }

  @Get('statement/:apartmentId')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Apartment financial statement / ledger' })
  getStatement(@Param('apartmentId') apartmentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getApartmentStatement(apartmentId, user);
  }

  @Get('payments')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Payment transactions report' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getPaymentReport(user, {
      organizationId,
      buildingId,
      startDate,
      endDate,
    });
  }
}
