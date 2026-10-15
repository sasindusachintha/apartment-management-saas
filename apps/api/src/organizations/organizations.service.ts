import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(user: AuthenticatedUser) {
    if (user.isPlatformAdmin) {
      return this.prisma.organization.findMany({
        include: {
          _count: { select: { buildings: true, subscriptions: true, userRoles: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Tenant isolation: filter strictly by memberships
    const authorizedOrgIds = user.memberships
      .map((m) => m.organizationId)
      .filter(Boolean) as string[];

    return this.prisma.organization.findMany({
      where: { id: { in: authorizedOrgIds } },
      include: {
        _count: { select: { buildings: true, subscriptions: true, userRoles: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    // Tenant check
    if (!user.isPlatformAdmin) {
      const hasAccess = user.memberships.some((m) => m.organizationId === id);
      if (!hasAccess) {
        throw new NotFoundException(`Organization not found`);
      }
    }

    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        buildings: true,
        subscriptions: {
          include: { invoices: true },
        },
        userRoles: {
          include: {
            user: { select: { id: true, name: true, email: true, status: true } },
            role: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization not found`);
    }

    return org;
  }

  async create(dto: CreateOrganizationDto, user: AuthenticatedUser) {
    // Check duplicate slug
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException(`An organization with slug "${dto.slug}" already exists`);
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        status: 'ACTIVE',
      },
    });

    // If non-platform-admin created it, make them OWNER of the new organization
    const ownerRole = await this.prisma.role.findUnique({
      where: { name: 'OWNER' },
    });

    if (ownerRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
          organizationId: org.id,
        },
      });
    }

    await this.auditService.log({
      organizationId: org.id,
      actorUserId: user.id,
      action: 'ORGANIZATION_CREATED',
      entityType: 'Organization',
      entityId: org.id,
      metadata: { name: org.name, slug: org.slug },
    });

    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, user: AuthenticatedUser) {
    await this.findOne(id, user);

    const updated = await this.prisma.organization.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      organizationId: id,
      actorUserId: user.id,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'Organization',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }
}
