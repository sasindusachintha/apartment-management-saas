import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class BuildingsService {
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

  async findAll(user: AuthenticatedUser, organizationId?: string) {
    const userBuildingIds = user.memberships
      .map((m) => m.buildingId)
      .filter(Boolean) as string[];

    const where: Prisma.BuildingWhereInput = {};

    if (organizationId) {
      this.verifyTenantAccess(user, organizationId);
      where.organizationId = organizationId;
    } else if (!user.isPlatformAdmin) {
      const authorizedOrgIds = user.memberships
        .map((m) => m.organizationId)
        .filter(Boolean) as string[];
      where.organizationId = { in: authorizedOrgIds };
    }

    if (!user.isPlatformAdmin && userBuildingIds.length > 0) {
      where.id = { in: userBuildingIds };
    }

    return this.prisma.building.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        towers: { where: { isActive: true }, select: { id: true, name: true, code: true, totalFloors: true } },
        userRoles: {
          include: {
            user: { select: { id: true, name: true, email: true, status: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        towers: { where: { isActive: true }, select: { id: true, name: true, code: true, totalFloors: true } },
        userRoles: {
          include: {
            user: { select: { id: true, name: true, email: true, status: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!building) {
      throw new NotFoundException(`Building not found`);
    }

    this.verifyTenantAccess(user, building.organizationId);

    const userBuildingIds = user.memberships
      .map((m) => m.buildingId)
      .filter(Boolean) as string[];

    if (!user.isPlatformAdmin && userBuildingIds.length > 0 && !userBuildingIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this building layout');
    }

    return building;
  }

  async create(dto: CreateBuildingDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    const building = await this.prisma.building.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        address: dto.address,
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'BUILDING_CREATED',
      entityType: 'Building',
      entityId: building.id,
      metadata: { name: building.name, address: building.address },
    });

    return building;
  }

  async update(id: string, dto: UpdateBuildingDto, user: AuthenticatedUser) {
    const existing = await this.findOne(id, user);

    const updated = await this.prisma.building.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      organizationId: existing.organizationId,
      actorUserId: user.id,
      action: 'BUILDING_UPDATED',
      entityType: 'Building',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }
}
