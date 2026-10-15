import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApartmentsService } from './apartments.service';
import { CreateApartmentDto } from './dto/create-apartment.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';
import { CreateTowerDto, UpdateTowerDto } from './dto/tower.dto';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { AssignRenterDto } from './dto/assign-renter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Apartments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'apartments', version: '1' })
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  // ─────────────────────────────────────────────
  // Towers & Blocks (Building Structure)
  // ─────────────────────────────────────────────

  @Get('towers/list')
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'List towers or blocks for a building' })
  @ApiQuery({ name: 'buildingId', required: false })
  findAllTowers(@CurrentUser() user: AuthenticatedUser, @Query('buildingId') buildingId?: string) {
    return this.apartmentsService.findAllTowers(user, buildingId);
  }

  @Post('towers')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tower or block' })
  createTower(@Body() dto: CreateTowerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.createTower(dto, user);
  }

  @Patch('towers/:id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'Update a tower or block' })
  updateTower(
    @Param('id') id: string,
    @Body() dto: UpdateTowerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apartmentsService.updateTower(id, dto, user);
  }

  @Delete('towers/:id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'Deactivate a tower' })
  deleteTower(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.deleteTower(id, user);
  }

  // ─────────────────────────────────────────────
  // Apartments (Units) & Visual Availability Map
  // ─────────────────────────────────────────────

  @Get('my-apartment')
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'Get current user assigned apartment details and rooms' })
  getMyApartment(@CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.getMyApartment(user);
  }

  @Get('building-layout/:buildingId')
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'Get building layout in cinema-seat style availability grid' })
  @ApiQuery({ name: 'towerId', required: false })
  @ApiQuery({ name: 'floor', required: false, type: Number })
  getBuildingLayout(
    @Param('buildingId') buildingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('towerId') towerId?: string,
    @Query('floor') floor?: string,
  ) {
    const floorNum = floor !== undefined && floor !== '' ? parseInt(floor, 10) : undefined;
    return this.apartmentsService.getBuildingLayout(buildingId, { towerId, floor: floorNum }, user);
  }

  @Get()
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'List apartments with filters and search' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'towerId', required: false })
  @ApiQuery({ name: 'floor', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('towerId') towerId?: string,
    @Query('floor') floor?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('isActive') isActive?: string,
  ) {
    const activeBool = isActive !== undefined ? isActive === 'true' : undefined;
    const floorNum = floor !== undefined && floor !== '' ? parseInt(floor, 10) : undefined;
    return this.apartmentsService.findAll(user, {
      organizationId,
      buildingId,
      towerId,
      floor: floorNum,
      search,
      status,
      isActive: activeBool,
    });
  }

  // ─────────────────────────────────────────────
  // Individual Rooms Management
  // ─────────────────────────────────────────────

  @Get(':apartmentId/rooms')
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'Get all rooms and calculation breakdown for an apartment' })
  findRooms(@Param('apartmentId') apartmentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.findRooms(apartmentId, user);
  }

  @Post('rooms')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an individual room to an apartment' })
  createRoom(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.createRoom(dto, user);
  }

  @Patch('rooms/:id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'Update an individual room' })
  updateRoom(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apartmentsService.updateRoom(id, dto, user);
  }

  @Delete('rooms/:id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'Deactivate or remove a room' })
  deleteRoom(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.deleteRoom(id, user);
  }

  // ─────────────────────────────────────────────
  // Single Apartment Unit Management
  // ─────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'Get apartment details by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.findOne(id, user);
  }

  @Post(':id/assign-renter')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'Assign a renter to an apartment' })
  assignRenter(
    @Param('id') id: string,
    @Body() dto: AssignRenterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apartmentsService.assignRenter(id, dto, user);
  }

  @Post(':id/end-tenancy')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'End tenancy and mark apartment as vacant' })
  endTenancy(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.endTenancy(id, user);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new apartment record' })
  create(@Body() dto: CreateApartmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'Update an apartment record' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apartmentsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('apartments.manage')
  @ApiOperation({ summary: 'Deactivate an apartment record' })
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.apartmentsService.deactivate(id, user);
  }
}
