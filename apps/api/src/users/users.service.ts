import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(user: AuthenticatedUser, organizationId?: string) {
    if (organizationId) {
      if (!user.isPlatformAdmin) {
        const hasMembership = user.memberships.some((m) => m.organizationId === organizationId);
        if (!hasMembership) {
          throw new NotFoundException('Resource not found');
        }
      }

      return this.prisma.user.findMany({
        where: {
          userRoles: {
            some: { organizationId },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          userRoles: {
            where: { organizationId },
            include: { role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.isPlatformAdmin) {
      return this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          userRoles: {
            include: { role: true, organization: true, building: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Default to users in caller's organizations
    const authorizedOrgIds = user.memberships
      .map((m) => m.organizationId)
      .filter(Boolean) as string[];

    return this.prisma.user.findMany({
      where: {
        userRoles: {
          some: { organizationId: { in: authorizedOrgIds } },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        userRoles: {
          where: { organizationId: { in: authorizedOrgIds } },
          include: { role: true, organization: true, building: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        userRoles: {
          include: { role: true, organization: true, building: true },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!user.isPlatformAdmin) {
      const authorizedOrgIds = user.memberships
        .map((m) => m.organizationId)
        .filter(Boolean) as string[];

      const sharesOrg = targetUser.userRoles.some(
        (ur) => ur.organizationId && authorizedOrgIds.includes(ur.organizationId),
      );

      if (!sharesOrg && targetUser.id !== user.id) {
        throw new NotFoundException('Resource not found');
      }
    }

    return targetUser;
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Prevent duplicate email
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new BadRequestException('A user with that email already exists');
    }

    // Role assignment security: exactly 3 roles
    const targetRoleName = dto.initialRole || 'BUILDING_OWNER';
    if (
      (targetRoleName === 'SUPER_ADMIN' || targetRoleName === 'PLATFORM_ADMIN') &&
      !actor.isPlatformAdmin
    ) {
      throw new ForbiddenException(
        'Only platform administrators can assign platform administrative roles',
      );
    }

    const VALID_ROLES = ['SUPER_ADMIN', 'BUILDING_OWNER', 'RENTER'];
    if (!VALID_ROLES.includes(targetRoleName)) {
      throw new BadRequestException(
        `Role "${targetRoleName}" is not valid. Only SUPER_ADMIN, BUILDING_OWNER, and RENTER are supported.`,
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { name: targetRoleName },
    });

    if (!role) {
      throw new BadRequestException(`Role "${targetRoleName}" does not exist`);
    }

    // Determine target organization
    let orgId = dto.organizationId;
    if (!actor.isPlatformAdmin) {
      if (!orgId) {
        orgId = actor.memberships[0]?.organizationId ?? undefined;
      } else {
        const belongs = actor.memberships.some((m) => m.organizationId === orgId);
        if (!belongs) {
          throw new ForbiddenException('Cannot create users in another organization');
        }
      }
    }

    const passwordHash = await argon2.hash(dto.password);

    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        phone: dto.phone,
        passwordHash,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    // Assign role
    await this.prisma.userRole.create({
      data: {
        userId: newUser.id,
        roleId: role.id,
        organizationId: (targetRoleName === 'SUPER_ADMIN' || targetRoleName === 'PLATFORM_ADMIN') ? null : orgId,
        buildingId: dto.buildingId,
      },
    });

    await this.auditService.log({
      organizationId: orgId ?? null,
      actorUserId: actor.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      metadata: { roleName: targetRoleName, email: newUser.email },
    });

    return newUser;
  }

  async assignRole(userId: string, dto: AssignRoleDto, actor: AuthenticatedUser) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (
      (dto.roleName === 'SUPER_ADMIN' || dto.roleName === 'PLATFORM_ADMIN') &&
      !actor.isPlatformAdmin
    ) {
      throw new ForbiddenException('Only platform admins can assign platform administrative roles');
    }

    const VALID_ROLES = ['SUPER_ADMIN', 'BUILDING_OWNER', 'RENTER'];
    if (!VALID_ROLES.includes(dto.roleName)) {
      throw new BadRequestException(
        `Role "${dto.roleName}" is not valid. Only SUPER_ADMIN, BUILDING_OWNER, and RENTER are supported.`,
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { name: dto.roleName },
    });

    if (!role) {
      throw new BadRequestException(`Role "${dto.roleName}" does not exist`);
    }

    let orgId = dto.organizationId;
    if (!actor.isPlatformAdmin) {
      if (!orgId) {
        orgId = actor.memberships[0]?.organizationId ?? undefined;
      } else {
        const belongs = actor.memberships.some((m) => m.organizationId === orgId);
        if (!belongs) {
          throw new ForbiddenException('Cannot assign roles for another organization');
        }
      }
    }

    // Check duplicate role assignment
    const isGlobal = dto.roleName === 'PLATFORM_ADMIN' || dto.roleName === 'SUPER_ADMIN';
    const existingRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        organizationId: isGlobal ? null : orgId,
        buildingId: dto.buildingId ?? null,
      },
    });

    if (existingRole) {
      throw new BadRequestException('User already has this role assignment');
    }

    const userRole = await this.prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        organizationId: isGlobal ? null : orgId,
        buildingId: dto.buildingId,
      },
      include: { role: true },
    });

    await this.auditService.log({
      organizationId: orgId ?? null,
      actorUserId: actor.id,
      action: 'USER_ROLE_ASSIGNED',
      entityType: 'UserRole',
      entityId: userRole.id,
      metadata: { userId, roleName: dto.roleName, orgId, buildingId: dto.buildingId },
    });

    return userRole;
  }

  async updateUserStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED',
    actor: AuthenticatedUser,
  ) {
    if (!actor.isPlatformAdmin) {
      throw new ForbiddenException('Only Super Admins can update user status or suspend owners');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Do not allow suspending oneself
    if (targetUser.id === actor.id && status === 'SUSPENDED') {
      throw new BadRequestException('You cannot suspend your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        userRoles: { include: { role: true, organization: true } },
      },
    });

    await this.auditService.log({
      actorUserId: actor.id,
      action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_STATUS_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: { previousStatus: targetUser.status, newStatus: status, userEmail: targetUser.email },
    });

    return updated;
  }
}
