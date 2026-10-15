import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateApartmentDto } from './dto/create-apartment.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';
import { CreateTowerDto, UpdateTowerDto } from './dto/tower.dto';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class ApartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private verifyTenantAccess(user: AuthenticatedUser, organizationId: string): void {
    if (user.isPlatformAdmin) return;
    const hasMembership = user.memberships.some((m) => m.organizationId === organizationId);
    if (!hasMembership) {
      throw new NotFoundException('Resource not found');
    }
  }

  private isRenter(user: AuthenticatedUser): boolean {
    if (user.isPlatformAdmin) return false;
    const isOwnerOrAdmin = user.memberships.some(
      (m) =>
        m.roleName === 'SUPER_ADMIN' ||
        m.roleName === 'PLATFORM_ADMIN' ||
        m.roleName === 'BUILDING_OWNER' ||
        m.roleName === 'OWNER' ||
        m.roleName === 'MANAGER',
    );
    if (isOwnerOrAdmin) return false;
    return user.memberships.some((m) => m.roleName === 'RENTER' || m.roleName === 'RESIDENT');
  }

  private verifyBuildingAccess(user: AuthenticatedUser, buildingId: string): void {
    if (user.isPlatformAdmin) return;
    const isSuperAdmin = user.memberships.some(
      (m) => m.roleName === 'SUPER_ADMIN' || m.roleName === 'PLATFORM_ADMIN',
    );
    if (isSuperAdmin) return;

    const userBuildingIds = user.memberships
      .map((m) => m.buildingId)
      .filter(Boolean) as string[];

    if (userBuildingIds.length > 0 && !userBuildingIds.includes(buildingId)) {
      throw new ForbiddenException('You do not have access to this building layout');
    }
  }

  private verifyRenterWriteBlocked(user: AuthenticatedUser): void {
    if (this.isRenter(user)) {
      throw new ForbiddenException('Renters cannot modify apartment or room data');
    }
  }

  // ─────────────────────────────────────────────
  // Towers & Blocks (Building Structure)
  // ─────────────────────────────────────────────

  async findAllTowers(user: AuthenticatedUser, buildingId?: string) {
    if (this.isRenter(user)) {
      throw new ForbiddenException('Renters cannot view building tower layouts');
    }

    const where: Prisma.TowerWhereInput = {};

    if (buildingId) {
      this.verifyBuildingAccess(user, buildingId);
      const b = await this.prisma.building.findUnique({ where: { id: buildingId } });
      if (b) {
        this.verifyTenantAccess(user, b.organizationId);
        where.buildingId = buildingId;
      }
    } else if (!user.isPlatformAdmin) {
      const userBuildingIds = user.memberships
        .map((m) => m.buildingId)
        .filter(Boolean) as string[];

      if (userBuildingIds.length > 0) {
        where.buildingId = { in: userBuildingIds };
      } else {
        const authorizedOrgIds = user.memberships
          .map((m) => m.organizationId)
          .filter(Boolean) as string[];
        where.organizationId = { in: authorizedOrgIds };
      }
    }

    return this.prisma.tower.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        _count: { select: { apartments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTower(dto: CreateTowerDto, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    this.verifyTenantAccess(user, dto.organizationId);
    this.verifyBuildingAccess(user, dto.buildingId);

    const existing = await this.prisma.tower.findUnique({
      where: {
        buildingId_name: {
          buildingId: dto.buildingId,
          name: dto.name.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Tower "${dto.name}" already exists in this building`);
    }

    const tower = await this.prisma.tower.create({
      data: {
        organizationId: dto.organizationId,
        buildingId: dto.buildingId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        totalFloors: dto.totalFloors ?? 1,
        description: dto.description || null,
        isActive: true,
      },
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'TOWER_CREATED',
      entityType: 'Tower',
      entityId: tower.id,
      metadata: { name: tower.name, buildingId: tower.buildingId },
    });

    return tower;
  }

  async updateTower(id: string, dto: UpdateTowerDto, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.tower.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tower not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    const updated = await this.prisma.tower.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        totalFloors: dto.totalFloors,
        description: dto.description,
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  async deleteTower(id: string, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.tower.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tower not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    return this.prisma.tower.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─────────────────────────────────────────────
  // Apartments (Units)
  // ─────────────────────────────────────────────

  async findAll(
    user: AuthenticatedUser,
    params: {
      organizationId?: string;
      buildingId?: string;
      towerId?: string;
      floor?: number;
      search?: string;
      status?: string;
      isActive?: boolean;
    },
  ) {
    const where: Prisma.ApartmentWhereInput = {};

    if (this.isRenter(user)) {
      where.OR = [
        { residentId: user.id },
        { residentEmail: user.email },
        { ownerId: user.id },
        { ownerEmail: user.email },
      ];
    } else {
      if (params.organizationId) {
        this.verifyTenantAccess(user, params.organizationId);
        where.organizationId = params.organizationId;
      } else if (!user.isPlatformAdmin) {
        const authorizedOrgIds = user.memberships
          .map((m) => m.organizationId)
          .filter(Boolean) as string[];
        where.organizationId = { in: authorizedOrgIds };
      }

      const userBuildingIds = user.memberships
        .map((m) => m.buildingId)
        .filter(Boolean) as string[];

      if (!user.isPlatformAdmin && userBuildingIds.length > 0) {
        if (params.buildingId && !userBuildingIds.includes(params.buildingId)) {
          throw new ForbiddenException('You do not have access to this building layout');
        }
        where.buildingId = params.buildingId || { in: userBuildingIds };
      } else if (params.buildingId) {
        where.buildingId = params.buildingId;
      }
    }

    if (params.towerId) where.towerId = params.towerId;
    if (params.floor !== undefined) where.floor = params.floor;
    if (params.status) where.status = params.status as any;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    if (params.search) {
      const term = params.search.trim();
      const searchConditions = [
        { unitNumber: { contains: term } },
        { ownerName: { contains: term } },
        { residentName: { contains: term } },
        { ownerPhone: { contains: term } },
        { ownerEmail: { contains: term } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const apartments = await this.prisma.apartment.findMany({
      where,
      include: {
        building: { select: { id: true, name: true, address: true } },
        tower: { select: { id: true, name: true, code: true } },
        owner: { select: { id: true, name: true, email: true, phone: true } },
        resident: { select: { id: true, name: true, email: true, phone: true } },
        rooms: {
          where: { isActive: true },
          select: { id: true, roomNumber: true, roomType: true, areaSqft: true, maintenanceRate: true },
        },
        invoices: {
          where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
          select: { balanceDue: true },
        },
      },
      orderBy: [{ buildingId: 'asc' }, { floor: 'asc' }, { unitNumber: 'asc' }],
    });

    return apartments.map((apt) => {
      const totalArrears = apt.invoices.reduce(
        (sum, inv) => sum.plus(inv.balanceDue),
        new Prisma.Decimal(0),
      );

      // Total area calculation: if rooms exist, authoritative area is sum of active rooms
      const totalRoomArea = apt.rooms.reduce(
        (sum, r) => sum.plus(r.areaSqft),
        new Prisma.Decimal(0),
      );
      const effectiveArea = apt.rooms.length > 0 ? totalRoomArea : apt.areaSqft;

      const { invoices, ...rest } = apt;
      return {
        ...rest,
        effectiveAreaSqft: effectiveArea,
        roomsCount: (apt as any).roomCount ?? (apt.rooms.length > 0 ? apt.rooms.length : 1),
        outstandingArrears: totalArrears,
      };
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
      include: {
        building: {
          include: {
            billingSettings: true,
          },
        },
        tower: true,
        rooms: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        owner: { select: { id: true, name: true, email: true, phone: true } },
        resident: { select: { id: true, name: true, email: true, phone: true } },
        invoices: {
          take: 10,
          orderBy: { issueDate: 'desc' },
          include: { items: true },
        },
        payments: {
          take: 10,
          orderBy: { paymentDate: 'desc' },
        },
        waterReadings: {
          take: 6,
          orderBy: { readingDate: 'desc' },
        },
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (this.isRenter(user)) {
      const isMyApartment =
        apartment.residentId === user.id ||
        apartment.residentEmail === user.email ||
        apartment.ownerId === user.id ||
        apartment.ownerEmail === user.email;

      if (!isMyApartment) {
        throw new ForbiddenException('You can only view your own assigned apartment');
      }
    } else {
      this.verifyTenantAccess(user, apartment.organizationId);
      this.verifyBuildingAccess(user, apartment.buildingId);
    }

    const outstandingInvoices = await this.prisma.apartmentInvoice.findMany({
      where: {
        apartmentId: id,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { balanceDue: true },
    });

    const totalArrears = outstandingInvoices.reduce(
      (sum, inv) => sum.plus(inv.balanceDue),
      new Prisma.Decimal(0),
    );

    // Calculate room-based summary
    const defaultRate = apartment.building.billingSettings[0]?.maintenanceRatePerSqft ?? new Prisma.Decimal(10.0);
    const roomsWithCalculations = apartment.rooms.map((room) => {
      const rate = room.maintenanceRate ?? defaultRate;
      const charge = room.areaSqft.times(rate);
      return {
        ...room,
        applicableRate: rate,
        monthlyCharge: charge,
      };
    });

    const totalRoomArea = roomsWithCalculations.reduce((sum, r) => sum.plus(r.areaSqft), new Prisma.Decimal(0));
    const totalRoomCharge = roomsWithCalculations.reduce((sum, r) => sum.plus(r.monthlyCharge), new Prisma.Decimal(0));

    return {
      ...apartment,
      rooms: roomsWithCalculations,
      roomsCount: (apartment as any).roomCount ?? (apartment.rooms.length > 0 ? apartment.rooms.length : 1),
      totalRoomArea: apartment.rooms.length > 0 ? totalRoomArea : apartment.areaSqft,
      totalRoomCharge: apartment.rooms.length > 0 ? totalRoomCharge : apartment.areaSqft.times(defaultRate),
      outstandingArrears: totalArrears,
    };
  }

  async create(dto: CreateApartmentDto, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    this.verifyTenantAccess(user, dto.organizationId);
    this.verifyBuildingAccess(user, dto.buildingId);

    const building = await this.prisma.building.findFirst({
      where: { id: dto.buildingId, organizationId: dto.organizationId },
    });
    if (!building) {
      throw new BadRequestException('Invalid building for selected organization');
    }

    // Verify tower if specified
    if (dto.towerId) {
      const tower = await this.prisma.tower.findFirst({
        where: { id: dto.towerId, buildingId: dto.buildingId },
      });
      if (!tower) {
        throw new BadRequestException('Invalid tower for selected building');
      }
    }

    const existing = await this.prisma.apartment.findUnique({
      where: {
        buildingId_unitNumber: {
          buildingId: dto.buildingId,
          unitNumber: dto.unitNumber.trim(),
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Apartment ${dto.unitNumber} already exists in building "${building.name}"`,
      );
    }

    const apartment = await this.prisma.apartment.create({
      data: {
        organizationId: dto.organizationId,
        buildingId: dto.buildingId,
        towerId: dto.towerId || null,
        unitNumber: dto.unitNumber.trim(),
        floor: dto.floor ?? 1,
        areaSqft: new Prisma.Decimal(dto.areaSqft),
        roomCount: dto.roomCount !== undefined ? Number(dto.roomCount) : 1,
        status: dto.status ?? 'ACTIVE',
        ownerId: dto.ownerId ?? null,
        residentId: dto.residentId ?? null,
        ownerName: dto.ownerName?.trim() ?? null,
        ownerEmail: dto.ownerEmail?.trim() ?? null,
        ownerPhone: dto.ownerPhone?.trim() ?? null,
        residentName: dto.residentName?.trim() ?? null,
        residentEmail: dto.residentEmail?.trim() ?? null,
        residentPhone: dto.residentPhone?.trim() ?? null,
        notes: dto.notes ?? null,
        isActive: true,
      },
      include: {
        building: { select: { id: true, name: true } },
        tower: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'APARTMENT_CREATED',
      entityType: 'Apartment',
      entityId: apartment.id,
      metadata: {
        unitNumber: apartment.unitNumber,
        buildingId: apartment.buildingId,
        towerId: dto.towerId,
        areaSqft: dto.areaSqft,
      },
    });

    return apartment;
  }

  async update(id: string, dto: UpdateApartmentDto, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.apartment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Apartment not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    if (dto.unitNumber && dto.unitNumber.trim() !== existing.unitNumber) {
      const duplicate = await this.prisma.apartment.findUnique({
        where: {
          buildingId_unitNumber: {
            buildingId: existing.buildingId,
            unitNumber: dto.unitNumber.trim(),
          },
        },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(`Apartment ${dto.unitNumber} already exists in this building`);
      }
    }

    const data: Prisma.ApartmentUpdateInput = {};
    if (dto.towerId !== undefined) {
      data.tower = dto.towerId ? { connect: { id: dto.towerId } } : { disconnect: true };
    }
    if (dto.unitNumber !== undefined) data.unitNumber = dto.unitNumber.trim();
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (dto.areaSqft !== undefined) data.areaSqft = new Prisma.Decimal(dto.areaSqft);
    if (dto.roomCount !== undefined) (data as any).roomCount = Number(dto.roomCount);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.ownerId !== undefined) {
      data.owner = dto.ownerId ? { connect: { id: dto.ownerId } } : { disconnect: true };
    }
    if (dto.residentId !== undefined) {
      data.resident = dto.residentId ? { connect: { id: dto.residentId } } : { disconnect: true };
    }
    if (dto.ownerName !== undefined) data.ownerName = dto.ownerName?.trim() || null;
    if (dto.ownerEmail !== undefined) data.ownerEmail = dto.ownerEmail?.trim() || null;
    if (dto.ownerPhone !== undefined) data.ownerPhone = dto.ownerPhone?.trim() || null;
    if (dto.residentName !== undefined) data.residentName = dto.residentName?.trim() || null;
    if (dto.residentEmail !== undefined) data.residentEmail = dto.residentEmail?.trim() || null;
    if (dto.residentPhone !== undefined) data.residentPhone = dto.residentPhone?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.apartment.update({
      where: { id },
      data,
      include: {
        building: { select: { id: true, name: true } },
        tower: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        resident: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      organizationId: existing.organizationId,
      actorUserId: user.id,
      action: 'APARTMENT_UPDATED',
      entityType: 'Apartment',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }

  async deactivate(id: string, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.apartment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Apartment not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    const updated = await this.prisma.apartment.update({
      where: { id },
      data: {
        isActive: false,
        status: 'INACTIVE',
      },
    });

    await this.auditService.log({
      organizationId: existing.organizationId,
      actorUserId: user.id,
      action: 'APARTMENT_DEACTIVATED',
      entityType: 'Apartment',
      entityId: id,
      metadata: { unitNumber: existing.unitNumber },
    });

    return updated;
  }

  // ─────────────────────────────────────────────
  // Tenancy Management
  // ─────────────────────────────────────────────

  async assignRenter(
    apartmentId: string,
    dto: {
      residentName: string;
      residentEmail?: string;
      residentPhone?: string;
      residentId?: string;
      notes?: string;
    },
    user: AuthenticatedUser,
  ) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: { building: true },
    });
    if (!existing) throw new NotFoundException('Apartment not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    const updated = await this.prisma.apartment.update({
      where: { id: apartmentId },
      data: {
        residentName: dto.residentName.trim(),
        residentEmail: dto.residentEmail?.trim() || null,
        residentPhone: dto.residentPhone?.trim() || null,
        residentId: dto.residentId || null,
        status: 'OCCUPIED',
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
      },
      include: {
        building: { select: { id: true, name: true } },
        tower: { select: { id: true, name: true } },
        rooms: { where: { isActive: true } },
      },
    });

    await this.auditService.log({
      organizationId: existing.organizationId,
      actorUserId: user.id,
      action: 'TENANCY_ASSIGNED',
      entityType: 'Apartment',
      entityId: apartmentId,
      metadata: {
        unitNumber: existing.unitNumber,
        residentName: dto.residentName,
        residentEmail: dto.residentEmail,
      },
    });

    return updated;
  }

  async endTenancy(apartmentId: string, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: { building: true },
    });
    if (!existing) throw new NotFoundException('Apartment not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    const updated = await this.prisma.apartment.update({
      where: { id: apartmentId },
      data: {
        residentName: null,
        residentEmail: null,
        residentPhone: null,
        residentId: null,
        status: 'VACANT',
      },
      include: {
        building: { select: { id: true, name: true } },
        tower: { select: { id: true, name: true } },
        rooms: { where: { isActive: true } },
      },
    });

    await this.auditService.log({
      organizationId: existing.organizationId,
      actorUserId: user.id,
      action: 'TENANCY_ENDED',
      entityType: 'Apartment',
      entityId: apartmentId,
      metadata: {
        unitNumber: existing.unitNumber,
        previousResident: existing.residentName,
      },
    });

    return updated;
  }

  // ─────────────────────────────────────────────
  // Renter My-Apartment View
  // ─────────────────────────────────────────────

  async getMyApartment(user: AuthenticatedUser) {
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        isActive: true,
        OR: [
          { residentId: user.id },
          { residentEmail: user.email },
          { ownerId: user.id },
          { ownerEmail: user.email },
        ],
      },
      include: {
        building: {
          include: {
            billingSettings: true,
          },
        },
        tower: true,
        rooms: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        invoices: {
          take: 5,
          orderBy: { issueDate: 'desc' },
          include: { items: true },
        },
        payments: {
          take: 5,
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!apartment) {
      throw new NotFoundException('No active apartment found for your account');
    }

    const defaultRate =
      apartment.building.billingSettings[0]?.maintenanceRatePerSqft ?? new Prisma.Decimal(10.0);

    const roomsWithCalculations = apartment.rooms.map((room) => {
      const applicableRate = room.maintenanceRate ?? defaultRate;
      const monthlyCharge = room.areaSqft.times(applicableRate);
      return {
        ...room,
        applicableRate,
        monthlyCharge,
      };
    });

    const outstandingInvoices = await this.prisma.apartmentInvoice.findMany({
      where: {
        apartmentId: apartment.id,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { balanceDue: true },
    });

    const totalArrears = outstandingInvoices.reduce(
      (sum, inv) => sum.plus(inv.balanceDue),
      new Prisma.Decimal(0),
    );

    const totalRoomArea = roomsWithCalculations.reduce(
      (sum, r) => sum.plus(r.areaSqft),
      new Prisma.Decimal(0),
    );
    const totalRoomCharge = roomsWithCalculations.reduce(
      (sum, r) => sum.plus(r.monthlyCharge),
      new Prisma.Decimal(0),
    );

    return {
      ...apartment,
      rooms: roomsWithCalculations,
      roomsCount: (apartment as any).roomCount ?? (apartment.rooms.length > 0 ? apartment.rooms.length : 1),
      totalRoomArea: apartment.rooms.length > 0 ? totalRoomArea : apartment.areaSqft,
      totalRoomCharge:
        apartment.rooms.length > 0 ? totalRoomCharge : apartment.areaSqft.times(defaultRate),
      outstandingArrears: totalArrears,
    };
  }

  // ─────────────────────────────────────────────
  // Visual Building Layout (Cinema Seat-Booking View)
  // ─────────────────────────────────────────────

  async getBuildingLayout(
    buildingId: string,
    params: { towerId?: string; floor?: number },
    user: AuthenticatedUser,
  ) {
    if (this.isRenter(user)) {
      throw new ForbiddenException('Renters cannot view building layout');
    }

    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
      include: {
        billingSettings: true,
        towers: {
          where: { isActive: true },
          select: { id: true, name: true, code: true, totalFloors: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    this.verifyTenantAccess(user, building.organizationId);
    this.verifyBuildingAccess(user, building.id);

    // Selected tower or default to first tower
    const selectedTower = params.towerId
      ? building.towers.find((t) => t.id === params.towerId)
      : building.towers[0];

    // Find all floors with apartments in this building / tower
    const floorRows = await this.prisma.apartment.findMany({
      where: {
        buildingId,
        ...(selectedTower ? { towerId: selectedTower.id } : {}),
      },
      select: { floor: true },
      distinct: ['floor'],
      orderBy: { floor: 'asc' },
    });

    const existingFloors = floorRows.map((f) => f.floor);
    const towerMaxFloors = selectedTower?.totalFloors || (existingFloors.length > 0 ? Math.max(...existingFloors) : 1);
    const allFloorsSet = new Set<number>(existingFloors);
    for (let f = 1; f <= Math.min(towerMaxFloors, 50); f++) {
      allFloorsSet.add(f);
    }
    const availableFloors = Array.from(allFloorsSet).sort((a, b) => a - b);

    const activeFloor = params.floor !== undefined ? params.floor : (availableFloors[0] ?? 1);

    // Fetch apartments on this specific floor & tower
    const apartments = await this.prisma.apartment.findMany({
      where: {
        buildingId,
        floor: activeFloor,
        ...(selectedTower ? { towerId: selectedTower.id } : {}),
      },
      include: {
        rooms: {
          where: { isActive: true },
          select: { id: true, roomNumber: true, roomType: true, areaSqft: true, maintenanceRate: true, isActive: true },
        },
        invoices: {
          where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
          select: { balanceDue: true },
        },
      },
      orderBy: { unitNumber: 'asc' },
    });

    const defaultRate =
      building.billingSettings[0]?.maintenanceRatePerSqft ?? new Prisma.Decimal(10.0);

    // Format apartments and calculate summary stats
    let availableCount = 0;
    let occupiedCount = 0;
    let maintenanceCount = 0;
    let inactiveCount = 0;

    const formattedApartments = apartments.map((apt) => {
      const arrears = apt.invoices.reduce(
        (sum, inv) => sum.plus(inv.balanceDue),
        new Prisma.Decimal(0),
      );

      const totalRoomArea = apt.rooms.reduce(
        (sum, r) => sum.plus(r.areaSqft),
        new Prisma.Decimal(0),
      );
      const effectiveArea = apt.rooms.length > 0 ? totalRoomArea : apt.areaSqft;

      // Status resolution
      let computedStatus: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
      if (!apt.isActive || apt.status === 'INACTIVE') {
        computedStatus = 'INACTIVE';
        inactiveCount++;
      } else if (apt.status === 'MAINTENANCE') {
        computedStatus = 'MAINTENANCE';
        maintenanceCount++;
      } else if (apt.status === 'OCCUPIED' || (apt.status === 'ACTIVE' && (apt.residentName || apt.residentId))) {
        computedStatus = 'OCCUPIED';
        occupiedCount++;
      } else {
        computedStatus = 'VACANT';
        availableCount++;
      }

      const { invoices, ...rest } = apt;
      return {
        ...rest,
        computedStatus,
        effectiveAreaSqft: effectiveArea,
        roomsCount: (apt as any).roomCount ?? (apt.rooms.length > 0 ? apt.rooms.length : 1),
        outstandingArrears: arrears,
      };
    });

    return {
      building: {
        id: building.id,
        name: building.name,
        address: building.address,
      },
      towers: building.towers,
      selectedTowerId: selectedTower?.id || null,
      availableFloors,
      activeFloor,
      summary: {
        totalApartments: formattedApartments.length,
        availableCount,
        occupiedCount,
        maintenanceCount,
        inactiveCount,
      },
      apartments: formattedApartments,
      defaultRate,
    };
  }

  // ─────────────────────────────────────────────
  // Individual Rooms Management & Calculations
  // ─────────────────────────────────────────────

  async findRooms(apartmentId: string, user: AuthenticatedUser) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        building: { include: { billingSettings: true } },
        rooms: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!apartment) throw new NotFoundException('Apartment not found');

    if (this.isRenter(user)) {
      const isMyApartment =
        apartment.residentId === user.id ||
        apartment.residentEmail === user.email ||
        apartment.ownerId === user.id ||
        apartment.ownerEmail === user.email;
      if (!isMyApartment) {
        throw new ForbiddenException('You can only view rooms for your own assigned apartment');
      }
    } else {
      this.verifyTenantAccess(user, apartment.organizationId);
      this.verifyBuildingAccess(user, apartment.buildingId);
    }

    const defaultRate = apartment.building.billingSettings[0]?.maintenanceRatePerSqft ?? new Prisma.Decimal(10.0);

    const roomsWithCalculations = apartment.rooms.map((room) => {
      const applicableRate = room.maintenanceRate ?? defaultRate;
      const monthlyCharge = room.areaSqft.times(applicableRate);
      return {
        ...room,
        applicableRate,
        monthlyCharge,
      };
    });

    const activeRooms = roomsWithCalculations.filter((r) => r.isActive);
    const totalArea = activeRooms.reduce((sum, r) => sum.plus(r.areaSqft), new Prisma.Decimal(0));
    const totalCharge = activeRooms.reduce((sum, r) => sum.plus(r.monthlyCharge), new Prisma.Decimal(0));

    return {
      apartmentId,
      unitNumber: apartment.unitNumber,
      defaultRate,
      rooms: roomsWithCalculations,
      totalArea: activeRooms.length > 0 ? totalArea : apartment.areaSqft,
      totalCharge: activeRooms.length > 0 ? totalCharge : apartment.areaSqft.times(defaultRate),
    };
  }

  async createRoom(dto: CreateRoomDto, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);

    const apartment = await this.prisma.apartment.findUnique({
      where: { id: dto.apartmentId },
      include: { building: { include: { billingSettings: true } } },
    });
    if (!apartment) throw new NotFoundException('Apartment not found');

    const organizationId = dto.organizationId || apartment.organizationId;
    const buildingId = dto.buildingId || apartment.buildingId;

    this.verifyTenantAccess(user, organizationId);
    this.verifyBuildingAccess(user, buildingId);

    // Prevent duplicate room name/number within the same apartment
    const existing = await this.prisma.apartmentRoom.findUnique({
      where: {
        apartmentId_roomNumber: {
          apartmentId: dto.apartmentId,
          roomNumber: dto.roomNumber.trim(),
        },
      },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException(
          `Room "${dto.roomNumber}" already exists in apartment Unit ${apartment.unitNumber}`,
        );
      } else {
        // Reactivate existing room with new values
        const reactivated = await this.prisma.apartmentRoom.update({
          where: { id: existing.id },
          data: {
            roomType: dto.roomType,
            areaSqft: new Prisma.Decimal(dto.areaSqft),
            maintenanceRate: dto.maintenanceRate !== undefined && dto.maintenanceRate !== null ? new Prisma.Decimal(dto.maintenanceRate) : null,
            notes: dto.notes ?? null,
            isActive: true,
          },
        });
        await this.syncApartmentAreaFromRooms(apartment.id);
        return reactivated;
      }
    }

    const room = await this.prisma.apartmentRoom.create({
      data: {
        organizationId,
        buildingId,
        apartmentId: dto.apartmentId,
        roomNumber: dto.roomNumber.trim(),
        roomType: dto.roomType,
        areaSqft: new Prisma.Decimal(dto.areaSqft),
        maintenanceRate: dto.maintenanceRate !== undefined && dto.maintenanceRate !== null ? new Prisma.Decimal(dto.maintenanceRate) : null,
        notes: dto.notes ?? null,
        isActive: true,
      },
    });

    // Sync apartment total area with sum of active room areas
    await this.syncApartmentAreaFromRooms(apartment.id);

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: 'ROOM_CREATED',
      entityType: 'ApartmentRoom',
      entityId: room.id,
      metadata: {
        apartmentId: dto.apartmentId,
        roomNumber: room.roomNumber,
        areaSqft: dto.areaSqft,
        roomType: dto.roomType,
      },
    });

    return room;
  }

  async updateRoom(id: string, dto: UpdateRoomDto, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.apartmentRoom.findUnique({
      where: { id },
      include: { apartment: true },
    });
    if (!existing) throw new NotFoundException('Room not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    // If room number changed, check uniqueness
    if (dto.roomNumber && dto.roomNumber.trim() !== existing.roomNumber) {
      const duplicate = await this.prisma.apartmentRoom.findUnique({
        where: {
          apartmentId_roomNumber: {
            apartmentId: existing.apartmentId,
            roomNumber: dto.roomNumber.trim(),
          },
        },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(`Room "${dto.roomNumber}" already exists in this apartment`);
      }
    }

    const data: Prisma.ApartmentRoomUpdateInput = {};
    if (dto.roomNumber !== undefined) data.roomNumber = dto.roomNumber.trim();
    if (dto.roomType !== undefined) data.roomType = dto.roomType;
    if (dto.areaSqft !== undefined) data.areaSqft = new Prisma.Decimal(dto.areaSqft);
    if (dto.maintenanceRate !== undefined) {
      data.maintenanceRate = dto.maintenanceRate !== null ? new Prisma.Decimal(dto.maintenanceRate) : null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.apartmentRoom.update({
      where: { id },
      data,
    });

    // Update parent apartment total area
    await this.syncApartmentAreaFromRooms(existing.apartmentId);

    await this.auditService.log({
      organizationId: existing.organizationId,
      actorUserId: user.id,
      action: 'ROOM_UPDATED',
      entityType: 'ApartmentRoom',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }

  async deleteRoom(id: string, user: AuthenticatedUser) {
    this.verifyRenterWriteBlocked(user);
    const existing = await this.prisma.apartmentRoom.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Room not found');
    this.verifyTenantAccess(user, existing.organizationId);
    this.verifyBuildingAccess(user, existing.buildingId);

    // Soft delete to protect financial invoice snapshot references
    const updated = await this.prisma.apartmentRoom.update({
      where: { id },
      data: { isActive: false },
    });

    await this.syncApartmentAreaFromRooms(existing.apartmentId);

    await this.auditService.log({
      organizationId: existing.organizationId,
      actorUserId: user.id,
      action: 'ROOM_DEACTIVATED',
      entityType: 'ApartmentRoom',
      entityId: id,
      metadata: { roomNumber: existing.roomNumber },
    });

    return updated;
  }

  private async syncApartmentAreaFromRooms(apartmentId: string): Promise<void> {
    const activeRooms = await this.prisma.apartmentRoom.findMany({
      where: { apartmentId, isActive: true },
    });

    if (activeRooms.length > 0) {
      const sumArea = activeRooms.reduce((sum, r) => sum.plus(r.areaSqft), new Prisma.Decimal(0));
      await this.prisma.apartment.update({
        where: { id: apartmentId },
        data: {
          areaSqft: sumArea,
          roomCount: activeRooms.length,
        } as any,
      });
    }
  }
}
