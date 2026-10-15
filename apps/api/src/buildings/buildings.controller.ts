import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Buildings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'buildings', version: '1' })
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  @RequirePermissions('buildings.read')
  @ApiOperation({ summary: 'List buildings within authorized scope' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.buildingsService.findAll(user, organizationId);
  }

  @Get(':id')
  @RequirePermissions('buildings.read')
  @ApiOperation({ summary: 'Get building by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.buildingsService.findOne(id, user);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @RequirePermissions('buildings.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new building' })
  create(@Body() dto: CreateBuildingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.buildingsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('buildings.manage')
  @ApiOperation({ summary: 'Update a building' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.buildingsService.update(id, dto, user);
  }
}
