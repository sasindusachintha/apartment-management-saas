import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('UsersService (Security & Anti-Privilege Escalation)', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    userRole: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('Duplicate Email Handling', () => {
    it('should reject creating a user when email is already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-existing',
        email: 'alice@acme.com',
      });

      const actor: Partial<AuthenticatedUser> = {
        id: 'owner-1',
        isPlatformAdmin: false,
        memberships: [
          {
            id: 'm-1',
            roleId: 'r-1',
            roleName: 'OWNER',
            organizationId: 'org-1',
            buildingId: null,
            permissions: [],
          },
        ],
      };

      await expect(
        service.create(
          {
            name: 'Alice Duplicate',
            email: 'alice@acme.com',
            password: 'StrongPassword123!',
          },
          actor as AuthenticatedUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Anti-Privilege Escalation', () => {
    it('should FORBID an organization administrator from granting PLATFORM_ADMIN role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null); // email is free

      const orgOwner: Partial<AuthenticatedUser> = {
        id: 'owner-1',
        isPlatformAdmin: false, // NOT platform admin!
        memberships: [
          {
            id: 'm-1',
            roleId: 'r-1',
            roleName: 'OWNER',
            organizationId: 'org-1',
            buildingId: null,
            permissions: [],
          },
        ],
      };

      await expect(
        service.create(
          {
            name: 'Attacker Elevate',
            email: 'attacker@acme.com',
            password: 'StrongPassword123!',
            initialRole: 'PLATFORM_ADMIN',
          },
          orgOwner as AuthenticatedUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should FORBID an organization administrator from assigning PLATFORM_ADMIN via assignRole', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'target-user' });

      const orgOwner: Partial<AuthenticatedUser> = {
        id: 'owner-1',
        isPlatformAdmin: false,
        memberships: [
          {
            id: 'm-1',
            roleId: 'r-1',
            roleName: 'OWNER',
            organizationId: 'org-1',
            buildingId: null,
            permissions: [],
          },
        ],
      };

      await expect(
        service.assignRole(
          'target-user',
          { roleName: 'PLATFORM_ADMIN' },
          orgOwner as AuthenticatedUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Duplicate Role Assignment', () => {
    it('should reject assigning duplicate role in the same organization', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'target-user' });
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-mgr', name: 'MANAGER' });
      mockPrismaService.userRole.findFirst.mockResolvedValue({ id: 'existing-role-assignment' }); // Already assigned!

      const admin: Partial<AuthenticatedUser> = {
        id: 'admin-1',
        isPlatformAdmin: true,
        memberships: [],
      };

      await expect(
        service.assignRole(
          'target-user',
          { roleName: 'MANAGER', organizationId: 'org-1' },
          admin as AuthenticatedUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
