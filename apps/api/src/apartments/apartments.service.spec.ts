import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { Prisma } from '@prisma/client';

describe('ApartmentsService — Visual Building Layout & Role Access Control', () => {
  let service: ApartmentsService;

  const mockPrismaService = {
    apartment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    apartmentRoom: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    apartmentInvoice: {
      findMany: jest.fn(),
    },
    building: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    tower: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(true),
  };

  const superAdminUser: AuthenticatedUser = {
    id: 'super-admin-1',
    name: 'Super Administrator',
    email: 'admin@apartmentsaas.com',
    status: 'ACTIVE',
    isPlatformAdmin: true,
    memberships: [
      {
        id: 'mem-super',
        roleId: 'role-super',
        roleName: 'SUPER_ADMIN',
        organizationId: null,
        buildingId: null,
        permissions: ['*'],
      },
    ],
  };

  const owner1User: AuthenticatedUser = {
    id: 'owner-1',
    name: 'Alice Acme',
    email: 'owner@acme.com',
    status: 'ACTIVE',
    isPlatformAdmin: false,
    memberships: [
      {
        id: 'mem-owner-1',
        roleId: 'role-owner',
        roleName: 'BUILDING_OWNER',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        permissions: ['apartments.read', 'apartments.write', 'buildings.read'],
      },
    ],
  };

  const owner2User: AuthenticatedUser = {
    id: 'owner-2',
    name: 'David Owner',
    email: 'owner2@acme.com',
    status: 'ACTIVE',
    isPlatformAdmin: false,
    memberships: [
      {
        id: 'mem-owner-2',
        roleId: 'role-owner',
        roleName: 'BUILDING_OWNER',
        organizationId: 'org-demo',
        buildingId: 'demo-building-1',
        permissions: ['apartments.read', 'apartments.write', 'buildings.read'],
      },
    ],
  };

  const renterUser: AuthenticatedUser = {
    id: 'renter-1',
    name: 'Tony David',
    email: 'renter@example.com',
    status: 'ACTIVE',
    isPlatformAdmin: false,
    memberships: [
      {
        id: 'mem-renter-1',
        roleId: 'role-renter',
        roleName: 'RENTER',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        permissions: ['my_apartment.read', 'invoices.read', 'payments.read'],
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApartmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ApartmentsService>(ApartmentsService);
  });

  describe('1. Building Layout (Cinema Seat Map)', () => {
    const mockBuilding = {
      id: 'span-tower-ix',
      name: 'Span Tower IX',
      organizationId: 'org-demo',
      billingSettings: [{ maintenanceRatePerSqft: new Prisma.Decimal(10.0) }],
      towers: [
        { id: 'tower-a', name: 'Tower A', code: 'T-A', totalFloors: 10, isActive: true },
      ],
    };

    const mockApartments = [
      {
        id: 'apt-1',
        unitNumber: 'A-101',
        floor: 1,
        status: 'OCCUPIED',
        residentName: 'Tony David',
        areaSqft: new Prisma.Decimal(1200),
        isActive: true,
        rooms: [{ id: 'r1', areaSqft: new Prisma.Decimal(400) }],
        invoices: [{ balanceDue: new Prisma.Decimal(2500) }],
      },
      {
        id: 'apt-2',
        unitNumber: 'A-102',
        floor: 1,
        status: 'VACANT',
        residentName: null,
        areaSqft: new Prisma.Decimal(950),
        isActive: true,
        rooms: [],
        invoices: [],
      },
      {
        id: 'apt-3',
        unitNumber: 'A-103',
        floor: 1,
        status: 'MAINTENANCE',
        residentName: null,
        areaSqft: new Prisma.Decimal(1100),
        isActive: true,
        rooms: [],
        invoices: [],
      },
      {
        id: 'apt-4',
        unitNumber: 'A-104',
        floor: 1,
        status: 'INACTIVE',
        residentName: null,
        areaSqft: new Prisma.Decimal(800),
        isActive: false,
        rooms: [],
        invoices: [],
      },
    ];

    it('should deny layout access to RENTER with 403 Forbidden', async () => {
      await expect(
        service.getBuildingLayout('span-tower-ix', { floor: 1 }, renterUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deny Owner 2 from viewing Owner 1 layout (building isolation)', async () => {
      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      await expect(
        service.getBuildingLayout('span-tower-ix', { floor: 1 }, owner2User),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow assigned Owner 1 to view their building layout and compute summary counts', async () => {
      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.apartment.findMany.mockResolvedValue(mockApartments);

      const result = await service.getBuildingLayout('span-tower-ix', { towerId: 'tower-a', floor: 1 }, owner1User);

      expect(result.building.name).toBe('Span Tower IX');
      expect(result.summary.totalApartments).toBe(4);
      expect(result.summary.occupiedCount).toBe(1);
      expect(result.summary.availableCount).toBe(1);
      expect(result.summary.maintenanceCount).toBe(1);
      expect(result.summary.inactiveCount).toBe(1);
      expect(result.apartments).toHaveLength(4);
      expect(result.apartments[0].unitNumber).toBe('A-101');
      expect(result.apartments[0].computedStatus).toBe('OCCUPIED');
      expect(Number(result.apartments[0].outstandingArrears)).toBe(2500);
    });

    it('should allow SUPER_ADMIN to inspect any building layout across platform', async () => {
      mockPrismaService.building.findUnique.mockResolvedValue(mockBuilding);
      mockPrismaService.apartment.findMany.mockResolvedValue(mockApartments);

      const result = await service.getBuildingLayout('span-tower-ix', { floor: 1 }, superAdminUser);
      expect(result.building.id).toBe('span-tower-ix');
      expect(result.summary.totalApartments).toBe(4);
    });
  });

  describe('2. Tenancy Assignment & Occupancy Flow', () => {
    it('should block RENTER from assigning a renter', async () => {
      await expect(
        service.assignRenter('apt-1', { residentName: 'Malicious' }, renterUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Owner to assign a renter and update status to OCCUPIED', async () => {
      mockPrismaService.apartment.findUnique.mockResolvedValue({
        id: 'apt-1',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        unitNumber: 'A-101',
        notes: null,
      });

      mockPrismaService.apartment.update.mockResolvedValue({
        id: 'apt-1',
        unitNumber: 'A-101',
        residentName: 'Tony David',
        residentEmail: 'renter@example.com',
        residentPhone: '+94 77 123 4567',
        status: 'OCCUPIED',
      });

      const res = await service.assignRenter(
        'apt-1',
        {
          residentName: 'Tony David',
          residentEmail: 'renter@example.com',
          residentPhone: '+94 77 123 4567',
        },
        owner1User,
      );

      expect(res.status).toBe('OCCUPIED');
      expect(res.residentName).toBe('Tony David');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TENANCY_ASSIGNED',
          entityType: 'Apartment',
          entityId: 'apt-1',
        }),
      );
    });

    it('should allow Owner to end tenancy and update status to VACANT', async () => {
      mockPrismaService.apartment.findUnique.mockResolvedValue({
        id: 'apt-1',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        unitNumber: 'A-101',
        residentName: 'Tony David',
      });

      mockPrismaService.apartment.update.mockResolvedValue({
        id: 'apt-1',
        unitNumber: 'A-101',
        residentName: null,
        status: 'VACANT',
      });

      const res = await service.endTenancy('apt-1', owner1User);

      expect(res.status).toBe('VACANT');
      expect(res.residentName).toBeNull();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TENANCY_ENDED',
          entityType: 'Apartment',
          entityId: 'apt-1',
        }),
      );
    });
  });

  describe('3. RENTER My-Apartment View', () => {
    it('should return assigned apartment with rooms and arrears for RENTER', async () => {
      mockPrismaService.apartment.findFirst.mockResolvedValue({
        id: 'apt-1',
        unitNumber: 'A-101',
        floor: 1,
        areaSqft: new Prisma.Decimal(1200),
        status: 'OCCUPIED',
        residentName: 'Tony David',
        residentEmail: 'renter@example.com',
        building: {
          id: 'span-tower-ix',
          name: 'Span Tower IX',
          address: 'No. 45, 1st Chapel Lane',
          billingSettings: [{ maintenanceRatePerSqft: new Prisma.Decimal(12.5) }],
        },
        tower: { id: 'tower-a', name: 'Tower A', code: 'T-A' },
        rooms: [
          {
            id: 'room-1',
            roomNumber: 'R-1',
            roomType: 'Master Bedroom',
            areaSqft: new Prisma.Decimal(500),
            maintenanceRate: null,
            isActive: true,
          },
          {
            id: 'room-2',
            roomNumber: 'R-2',
            roomType: 'Living Room',
            areaSqft: new Prisma.Decimal(700),
            maintenanceRate: new Prisma.Decimal(15.0),
            isActive: true,
          },
        ],
        invoices: [],
        payments: [],
      });

      mockPrismaService.apartmentInvoice.findMany.mockResolvedValue([
        { balanceDue: new Prisma.Decimal(3200) },
      ]);

      const myApt = await service.getMyApartment(renterUser);

      expect(myApt.unitNumber).toBe('A-101');
      expect(myApt.rooms).toHaveLength(2);
      expect(Number(myApt.totalRoomArea)).toBe(1200);
      expect(Number(myApt.outstandingArrears)).toBe(3200);
      expect(Number(myApt.rooms[0].applicableRate)).toBe(12.5);
      expect(Number(myApt.rooms[1].applicableRate)).toBe(15.0);
    });

    it('should throw NotFoundException if user has no assigned apartment', async () => {
      mockPrismaService.apartment.findFirst.mockResolvedValue(null);
      await expect(service.getMyApartment(renterUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Room Layout & Maintenance Area Calculations', () => {
    it('should block RENTER from creating rooms', async () => {
      await expect(
        service.createRoom(
          {
            organizationId: 'org-demo',
            buildingId: 'span-tower-ix',
            apartmentId: 'apt-1',
            roomNumber: 'R-99',
            roomType: 'BEDROOM',
            areaSqft: 200,
          },
          renterUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Owner to create a room and sync apartment total area', async () => {
      mockPrismaService.apartment.findFirst.mockResolvedValue({
        id: 'apt-1',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        unitNumber: 'A-101',
        building: {
          billingSettings: [{ maintenanceRatePerSqft: new Prisma.Decimal(10.0) }],
        },
      });

      mockPrismaService.apartmentRoom.findUnique.mockResolvedValue(null);
      mockPrismaService.apartmentRoom.create.mockResolvedValue({
        id: 'room-new',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        apartmentId: 'apt-1',
        roomNumber: 'Bed-1',
        roomType: 'BEDROOM',
        areaSqft: new Prisma.Decimal(300),
        maintenanceRate: new Prisma.Decimal(10.0),
        isActive: true,
      });

      mockPrismaService.apartmentRoom.findMany.mockResolvedValue([
        { areaSqft: new Prisma.Decimal(300), isActive: true },
      ]);
      mockPrismaService.apartment.update.mockResolvedValue({});

      const created = await service.createRoom(
        {
          organizationId: 'org-demo',
          buildingId: 'span-tower-ix',
          apartmentId: 'apt-1',
          roomNumber: 'Bed-1',
          roomType: 'BEDROOM',
          areaSqft: 300,
        },
        owner1User,
      );

      expect(created.roomNumber).toBe('Bed-1');
      expect(mockPrismaService.apartment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-1' },
          data: { areaSqft: new Prisma.Decimal(300) },
        }),
      );
    });
  });

  describe('5. Duplicate Unit Prevention & Validation', () => {
    it('should reject creating duplicate apartment number in same building', async () => {
      mockPrismaService.building.findFirst.mockResolvedValue({
        id: 'span-tower-ix',
        organizationId: 'org-demo',
      });

      mockPrismaService.apartment.findUnique.mockResolvedValue({
        id: 'existing-apt-1',
        unitNumber: 'A-101',
      });

      await expect(
        service.create(
          {
            organizationId: 'org-demo',
            buildingId: 'span-tower-ix',
            unitNumber: 'A-101',
            floor: 1,
            areaSqft: 1000,
          },
          owner1User,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
