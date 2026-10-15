import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    userRole: {
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
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it('should reject creation if organization slug is duplicate', async () => {
    mockPrismaService.organization.findUnique.mockResolvedValue({
      id: 'existing-org-1',
      slug: 'acme-properties',
    });

    const actor: Partial<AuthenticatedUser> = {
      id: 'user-1',
      isPlatformAdmin: true,
      memberships: [],
    };

    await expect(
      service.create(
        { name: 'Acme Properties 2', slug: 'acme-properties' },
        actor as AuthenticatedUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
