import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WaterReadingsService } from './water-readings.service';
import {
  BulkWaterReadingDto,
  RecordWaterReadingDto,
} from './dto/record-water-reading.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Water Readings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'water-readings', version: '1' })
export class WaterReadingsController {
  constructor(private readonly waterReadingsService: WaterReadingsService) {}

  @Get()
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'List water meter readings' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'periodCode', required: false })
  @ApiQuery({ name: 'apartmentId', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('periodCode') periodCode?: string,
    @Query('apartmentId') apartmentId?: string,
  ) {
    return this.waterReadingsService.findAll(user, {
      organizationId,
      buildingId,
      periodCode,
      apartmentId,
    });
  }

  @Get('latest/:apartmentId')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Get latest meter reading and default tariff for an apartment' })
  getLatest(@Param('apartmentId') apartmentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.waterReadingsService.getLatestForApartment(apartmentId, user);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record water meter reading for an apartment' })
  record(@Body() dto: RecordWaterReadingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.waterReadingsService.recordReading(dto, user);
  }

  @Post('bulk')
  @UseGuards(CsrfGuard)
  @RequirePermissions('billing.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk record water meter readings for a building' })
  bulkRecord(@Body() dto: BulkWaterReadingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.waterReadingsService.bulkRecord(dto, user);
  }
}
