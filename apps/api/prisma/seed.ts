import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

export const PERMISSIONS = [
  { key: 'organizations.read', description: 'View organization details' },
  { key: 'organizations.manage', description: 'Create, update, and manage organizations' },
  { key: 'buildings.read', description: 'View building details and listings' },
  { key: 'buildings.manage', description: 'Create, update, and manage buildings' },
  { key: 'users.read', description: 'View users and member assignments' },
  { key: 'users.manage', description: 'Invite, assign roles, and manage users' },
  { key: 'subscriptions.read', description: 'View subscription plans and invoices' },
  { key: 'subscriptions.manage', description: 'Manage subscriptions and billing' },
  { key: 'audit_logs.read', description: 'View organization and platform audit logs' },
  { key: 'apartments.read', description: 'View apartments and occupants' },
  { key: 'apartments.manage', description: 'Create, update, and manage apartments' },
  { key: 'billing.read', description: 'View billing settings, periods, and invoices' },
  { key: 'billing.manage', description: 'Create, generate, finalize, and adjust invoices' },
  { key: 'payments.read', description: 'View payments, receipts, and arrears' },
  { key: 'payments.manage', description: 'Record payments and allocate to invoices' },
  { key: 'reports.read', description: 'View financial and operational reports' },
] as const;

export const ROLE_DEFINITIONS: Record<string, { description: string; permissions: string[] }> = {
  SUPER_ADMIN: {
    description: 'Platform Super Administrator with complete system-wide management access',
    permissions: [
      'organizations.read',
      'organizations.manage',
      'buildings.read',
      'buildings.manage',
      'users.read',
      'users.manage',
      'subscriptions.read',
      'subscriptions.manage',
      'audit_logs.read',
      'apartments.read',
      'apartments.manage',
      'billing.read',
      'billing.manage',
      'payments.read',
      'payments.manage',
      'water.read',
      'water.manage',
      'reports.read',
    ],
  },
  BUILDING_OWNER: {
    description: 'Building Owner managing authorized building layouts, apartments, rooms, renters, and billing',
    permissions: [
      'organizations.read',
      'buildings.read',
      'buildings.manage',
      'users.read',
      'users.manage',
      'apartments.read',
      'apartments.manage',
      'billing.read',
      'billing.manage',
      'payments.read',
      'payments.manage',
      'water.read',
      'water.manage',
      'reports.read',
    ],
  },
  RENTER: {
    description: 'Renter with access to their own apartment, invoices, and payments',
    permissions: ['my_apartment.read', 'apartments.read', 'billing.read', 'payments.read'],
  },
};

async function main() {
  console.log('🌱 Starting database seed...');
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Seed Permissions
  console.log('👉 Seeding permissions...');
  const permissionMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: { key: perm.key, description: perm.description },
    });
    permissionMap.set(perm.key, record.id);
  }

  // 2. Seed Roles and RolePermissions
  console.log('👉 Seeding roles and role-permission mappings...');
  const roleMap = new Map<string, string>();
  for (const [roleName, def] of Object.entries(ROLE_DEFINITIONS)) {
    const roleRecord = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: def.description },
      create: { name: roleName, description: def.description },
    });
    roleMap.set(roleName, roleRecord.id);

    // Sync permissions for role
    for (const permKey of def.permissions) {
      const permId = permissionMap.get(permKey);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: roleRecord.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: roleRecord.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  // 3. Platform Admin Bootstrap
  console.log('👉 Checking platform admin bootstrap...');
  const adminEmail =
    process.env.BOOTSTRAP_ADMIN_EMAIL || (isProduction ? '' : 'admin@apartmentsaas.com');
  const adminPassword =
    process.env.BOOTSTRAP_ADMIN_PASSWORD || (isProduction ? '' : 'AdminSecure123!');
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME || 'Platform Administrator';

  if (isProduction) {
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'CRITICAL: BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD environment variables are required in production.',
      );
    }
    if (adminPassword.length < 12 || adminPassword === 'AdminSecure123!') {
      throw new Error(
        'CRITICAL: Insecure BOOTSTRAP_ADMIN_PASSWORD in production. Must be at least 12 characters and not default.',
      );
    }
  }

  if (adminEmail && adminPassword) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log(
        `ℹ️ Platform admin (${adminEmail}) already exists. Preserving existing password & credentials.`,
      );
      // Ensure SUPER_ADMIN role is assigned
      const superAdminRoleId = roleMap.get('SUPER_ADMIN')!;
      const existingUserRole = await prisma.userRole.findFirst({
        where: {
          userId: existingAdmin.id,
          roleId: superAdminRoleId,
          organizationId: null,
        },
      });

      if (!existingUserRole) {
        await prisma.userRole.create({
          data: {
            userId: existingAdmin.id,
            roleId: superAdminRoleId,
            organizationId: null,
          },
        });
      }
      console.log('✅ SUPER_ADMIN role linked to admin user.');
    } else {
      const passwordHash = await argon2.hash(adminPassword);
      const newAdmin = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });

      const superAdminRoleId = roleMap.get('SUPER_ADMIN')!;
      await prisma.userRole.create({
        data: {
          userId: newAdmin.id,
          roleId: superAdminRoleId,
          organizationId: null,
        },
      });

      // Audit log creation
      await prisma.auditLog.create({
        data: {
          action: 'BOOTSTRAP_ADMIN_CREATED',
          entityType: 'User',
          entityId: newAdmin.id,
          actorUserId: newAdmin.id,
          metadata: { note: 'Initial platform admin account bootstrap' },
        },
      });

      console.log(`✅ Created initial platform admin account: ${adminEmail}`);
    }
  }

  // 4. In development mode: seed a sample customer organization with owner, manager, building & subscription
  if (!isProduction) {
    console.log('👉 Seeding development demo tenant (Acme Properties)...');
    const demoOrg = await prisma.organization.upsert({
      where: { slug: 'acme-properties' },
      update: {},
      create: {
        name: 'Acme Property Management',
        slug: 'acme-properties',
        status: 'ACTIVE',
      },
    });

    // Create demo building
    const demoBuilding = await prisma.building.upsert({
      where: { id: 'demo-building-1' },
      update: {},
      create: {
        id: 'demo-building-1',
        organizationId: demoOrg.id,
        name: 'Sunset Heights Apartments',
        address: '100 Sunset Boulevard, Suite 100, Metropolis',
        status: 'ACTIVE',
      },
    });

    // Create demo active subscription
    const demoSub = await prisma.subscription.upsert({
      where: { id: 'demo-subscription-1' },
      update: {},
      create: {
        id: 'demo-subscription-1',
        organizationId: demoOrg.id,
        planName: 'Enterprise Growth',
        status: 'ACTIVE',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Create demo invoice
    await prisma.subscriptionInvoice.upsert({
      where: { invoiceNumber: 'INV-2026-001' },
      update: {},
      create: {
        subscriptionId: demoSub.id,
        invoiceNumber: 'INV-2026-001',
        amount: 499.0,
        currency: 'USD',
        status: 'PAID',
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
      },
    });

    // Create demo building: Span Tower IX (Condominium)
    console.log('👉 Seeding Span Tower IX condominium & apartment billing records...');
    const spanTower = await prisma.building.upsert({
      where: { id: 'span-tower-ix' },
      update: {},
      create: {
        id: 'span-tower-ix',
        organizationId: demoOrg.id,
        name: 'Span Tower IX',
        address: 'No. 45, 1st Chapel Lane, Colombo 06, Sri Lanka',
        status: 'ACTIVE',
      },
    });

    // Create demo owner 1: Alice Acme (BUILDING_OWNER of Span Tower IX)
    const ownerEmail = 'owner@acme.com';
    let ownerUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!ownerUser) {
      const ownerHash = await argon2.hash('OwnerSecure123!');
      ownerUser = await prisma.user.create({
        data: {
          name: 'Alice Acme (Building Owner)',
          email: ownerEmail,
          passwordHash: ownerHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });
    }

    const buildingOwnerRoleId = roleMap.get('BUILDING_OWNER')!;
    const exists = await prisma.userRole.findFirst({
      where: { userId: ownerUser.id, roleId: buildingOwnerRoleId, buildingId: spanTower.id },
    });
    if (!exists) {
      await prisma.userRole.create({
        data: {
          userId: ownerUser.id,
          roleId: buildingOwnerRoleId,
          organizationId: demoOrg.id,
          buildingId: spanTower.id,
        },
      });
    }
    console.log(`✅ Demo Building Owner 1 created: ${ownerEmail} (Assigned to Span Tower IX)`);

    // Create demo owner 2: David Owner (BUILDING_OWNER of demo-building-1, for isolation testing)
    const owner2Email = 'owner2@acme.com';
    let owner2User = await prisma.user.findUnique({ where: { email: owner2Email } });
    if (!owner2User) {
      const owner2Hash = await argon2.hash('OwnerSecure123!');
      owner2User = await prisma.user.create({
        data: {
          name: 'David Owner (Other Building)',
          email: owner2Email,
          passwordHash: owner2Hash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });
    }

    const exists2 = await prisma.userRole.findFirst({
      where: { userId: owner2User.id, roleId: buildingOwnerRoleId, buildingId: demoBuilding.id },
    });
    if (!exists2) {
      await prisma.userRole.create({
        data: {
          userId: owner2User.id,
          roleId: buildingOwnerRoleId,
          organizationId: demoOrg.id,
          buildingId: demoBuilding.id,
        },
      });
    }
    console.log(`✅ Demo Building Owner 2 created: ${owner2Email} (Assigned to Sunset Heights)`);

    // Create demo renter: Tony David (RENTER)
    const renterEmail = 'renter@example.com';
    let renterUser = await prisma.user.findUnique({ where: { email: renterEmail } });
    if (!renterUser) {
      const renterHash = await argon2.hash('RenterSecure123!');
      renterUser = await prisma.user.create({
        data: {
          name: 'Tony David (Renter)',
          email: renterEmail,
          passwordHash: renterHash,
          phone: '+94 77 020 1034',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });
    }

    const renterRoleId = roleMap.get('RENTER')!;
    const existsRenterRole = await prisma.userRole.findFirst({
      where: { userId: renterUser.id, roleId: renterRoleId },
    });
    if (!existsRenterRole) {
      await prisma.userRole.create({
        data: {
          userId: renterUser.id,
          roleId: renterRoleId,
          organizationId: demoOrg.id,
          buildingId: spanTower.id,
        },
      });
    }
    console.log(`✅ Demo Renter created: ${renterEmail} (Password: RenterSecure123!)`);

    // Create demo building manager as Building Owner of Sunset Heights
    const managerEmail = 'manager@acme.com';
    let managerUser = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (!managerUser) {
      const managerHash = await argon2.hash('ManagerSecure123!');
      managerUser = await prisma.user.create({
        data: {
          name: 'Bob Miller (Building Owner)',
          email: managerEmail,
          passwordHash: managerHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });
    }

    const existsManagerRole = await prisma.userRole.findFirst({
      where: { userId: managerUser.id, roleId: buildingOwnerRoleId, buildingId: demoBuilding.id },
    });
    if (!existsManagerRole) {
      await prisma.userRole.create({
        data: {
          userId: managerUser.id,
          roleId: buildingOwnerRoleId,
          organizationId: demoOrg.id,
          buildingId: demoBuilding.id,
        },
      });
    }
    console.log(
      `✅ Demo Building Owner (Bob Miller) created: ${managerEmail} (Assigned to Sunset Heights)`,
    );

    // Create Billing Settings for Span Tower IX
    await prisma.billingSetting.upsert({
      where: { buildingId: spanTower.id },
      update: {},
      create: {
        organizationId: demoOrg.id,
        buildingId: spanTower.id,
        maintenanceRatePerSqft: 10.00,
        defaultDueDays: 15,
        latePaymentPenaltyPercent: 15.00,
        latePaymentGraceDays: 5,
        waterTariffPerUnit: 118.00,
        waterFixedCharge: 0.00,
        bankName: 'Sampath Bank PLC',
        bankAccountName: 'Span Tower IX Management Corporation',
        bankAccountNumber: '003660000312',
        bankBranch: 'Wellawatta Branch',
        contactEmail: 'span.ebenezer@gmail.com',
        contactPhone: '+94 770201034',
        contactPerson: 'Mr. Tony David',
        paymentInstructions:
          'Kindly settle the total dues before the end of the month to the mentioned bank account. Please ensure that you include your apartment number as the payment narration.',
        noticeText:
          'Please note that as per a decision taken at the SGM held on 2nd November 2025, a 15% Monthly Penalty will be imposed on the outstanding dues of the maintenance fees and water bills.',
      },
    });

    // 1. Seed Towers in Span Tower IX
    console.log('👉 Seeding Towers (Tower A, Tower B)...');
    const towerA = await prisma.tower.upsert({
      where: {
        buildingId_name: {
          buildingId: spanTower.id,
          name: 'Tower A',
        },
      },
      update: {},
      create: {
        organizationId: demoOrg.id,
        buildingId: spanTower.id,
        name: 'Tower A',
        code: 'A',
        totalFloors: 8,
        description: 'Span Tower IX - Residential Tower A (Chapel Lane Wing)',
      },
    });

    const towerB = await prisma.tower.upsert({
      where: {
        buildingId_name: {
          buildingId: spanTower.id,
          name: 'Tower B',
        },
      },
      update: {},
      create: {
        organizationId: demoOrg.id,
        buildingId: spanTower.id,
        name: 'Tower B',
        code: 'B',
        totalFloors: 8,
        description: 'Span Tower IX - Residential Tower B (Sea View Wing)',
      },
    });

    // Create sample apartments in Span Tower IX with diverse real statuses
    const sampleApartments = [
      {
        unitNumber: 'A-101',
        towerId: towerA.id,
        floor: 1,
        areaSqft: 630.0,
        status: 'OCCUPIED' as const,
        ownerName: 'Mr. Tony David',
        residentName: 'Mr. Tony David',
        ownerPhone: '+94 77 020 1034',
        ownerEmail: 'span.ebenezer@gmail.com',
        residentPhone: '+94 77 020 1034',
        residentEmail: 'renter@example.com',
        residentId: renterUser.id,
        isActive: true,
      },
      {
        unitNumber: 'A-102',
        towerId: towerA.id,
        floor: 1,
        areaSqft: 950.0,
        status: 'OCCUPIED' as const,
        ownerName: 'Mr. K. Perera',
        residentName: 'Mr. K. Perera',
        ownerPhone: '+94 77 123 4567',
        ownerEmail: 'perera@example.com',
        residentPhone: '+94 77 123 4567',
        residentEmail: 'perera@example.com',
        isActive: true,
      },
      {
        unitNumber: 'A-103',
        towerId: towerA.id,
        floor: 1,
        areaSqft: 800.0,
        status: 'VACANT' as const,
        ownerName: 'Mr. M. Silva',
        residentName: null,
        ownerPhone: '+94 77 345 6789',
        ownerEmail: 'silva@example.com',
        residentPhone: null,
        residentEmail: null,
        isActive: true,
      },
      {
        unitNumber: 'A-104',
        towerId: towerA.id,
        floor: 1,
        areaSqft: 850.0,
        status: 'MAINTENANCE' as const,
        ownerName: 'Dr. K. Gunawardena',
        residentName: null,
        ownerPhone: '+94 77 456 7890',
        ownerEmail: 'gunawardena@example.com',
        residentPhone: null,
        residentEmail: null,
        notes: 'Under scheduled maintenance and repainting',
        isActive: true,
      },
      {
        unitNumber: 'A-105',
        towerId: towerA.id,
        floor: 1,
        areaSqft: 750.0,
        status: 'INACTIVE' as const,
        ownerName: 'Management Reserve',
        residentName: null,
        ownerPhone: null,
        ownerEmail: null,
        residentPhone: null,
        residentEmail: null,
        notes: 'Inactive unit / facility equipment store',
        isActive: false,
      },
      {
        unitNumber: 'A-106',
        towerId: towerA.id,
        floor: 1,
        areaSqft: 900.0,
        status: 'VACANT' as const,
        ownerName: 'Mrs. T. Fernando',
        residentName: null,
        ownerPhone: '+94 71 567 8901',
        ownerEmail: 'tfernando@example.com',
        residentPhone: null,
        residentEmail: null,
        isActive: true,
      },
      {
        unitNumber: 'A-201',
        towerId: towerA.id,
        floor: 2,
        areaSqft: 1000.0,
        status: 'OCCUPIED' as const,
        ownerName: 'Dr. S. Sivakumaran',
        residentName: 'Dr. S. Sivakumaran',
        ownerPhone: '+94 76 345 6789',
        ownerEmail: 'sivakumaran@example.com',
        residentPhone: '+94 76 345 6789',
        residentEmail: 'sivakumaran@example.com',
        isActive: true,
      },
      {
        unitNumber: 'A-202',
        towerId: towerA.id,
        floor: 2,
        areaSqft: 920.0,
        status: 'VACANT' as const,
        ownerName: 'Mr. H. Bandara',
        residentName: null,
        ownerPhone: '+94 71 678 9012',
        ownerEmail: 'bandara@example.com',
        residentPhone: null,
        residentEmail: null,
        isActive: true,
      },
      {
        unitNumber: 'A-203',
        towerId: towerA.id,
        floor: 2,
        areaSqft: 850.0,
        status: 'OCCUPIED' as const,
        ownerName: 'Mr. P. Rathnayake',
        residentName: 'Mr. P. Rathnayake',
        ownerPhone: '+94 77 789 0123',
        ownerEmail: 'rathnayake@example.com',
        residentPhone: '+94 77 789 0123',
        residentEmail: 'rathnayake@example.com',
        isActive: true,
      },
      {
        unitNumber: 'B-101',
        towerId: towerB.id,
        floor: 1,
        areaSqft: 1050.0,
        status: 'OCCUPIED' as const,
        ownerName: 'Mrs. N. Fernando',
        residentName: 'Tenant: S. Jayawardena',
        ownerPhone: '+94 71 234 5678',
        ownerEmail: 'fernando@example.com',
        residentPhone: '+94 71 234 5678',
        residentEmail: 'jayawardena@example.com',
        isActive: true,
      },
      {
        unitNumber: 'B-102',
        towerId: towerB.id,
        floor: 1,
        areaSqft: 1100.0,
        status: 'VACANT' as const,
        ownerName: 'Mr. V. De Silva',
        residentName: null,
        ownerPhone: '+94 77 890 1234',
        ownerEmail: 'desilva@example.com',
        residentPhone: null,
        residentEmail: null,
        isActive: true,
      },
      {
        unitNumber: '4B',
        towerId: towerA.id,
        floor: 4,
        areaSqft: 1000.0,
        status: 'OCCUPIED' as const,
        ownerName: 'Mr. R. Wickramasinghe',
        residentName: 'Mr. R. Wickramasinghe',
        ownerPhone: '+94 71 890 1234',
        ownerEmail: 'wickramasinghe@example.com',
        residentPhone: '+94 71 890 1234',
        residentEmail: 'wickramasinghe@example.com',
        isActive: true,
      },
      {
        unitNumber: '6/3',
        towerId: towerA.id,
        floor: 6,
        areaSqft: 964.0,
        status: 'OCCUPIED' as const,
        ownerName: 'Mr. C. Ebenezer',
        residentName: 'Mr. C. Ebenezer',
        ownerPhone: '+94 77 999 8888',
        ownerEmail: 'ebenezer@spantower.lk',
        residentPhone: '+94 77 999 8888',
        residentEmail: 'ebenezer@spantower.lk',
        isActive: true,
      },
    ];

    for (const apt of sampleApartments) {
      await prisma.apartment.upsert({
        where: {
          buildingId_unitNumber: {
            buildingId: spanTower.id,
            unitNumber: apt.unitNumber,
          },
        },
        update: {
          towerId: apt.towerId,
          floor: apt.floor,
          areaSqft: apt.areaSqft,
          status: apt.status,
          ownerName: apt.ownerName,
          ownerPhone: apt.ownerPhone,
          ownerEmail: apt.ownerEmail,
          residentName: apt.residentName,
          residentPhone: apt.residentPhone,
          residentEmail: apt.residentEmail,
          residentId: (apt as any).residentId || null,
          notes: (apt as any).notes || null,
          isActive: apt.isActive !== undefined ? apt.isActive : true,
        },
        create: {
          organizationId: demoOrg.id,
          buildingId: spanTower.id,
          towerId: apt.towerId,
          unitNumber: apt.unitNumber,
          floor: apt.floor,
          areaSqft: apt.areaSqft,
          status: apt.status,
          ownerName: apt.ownerName,
          ownerPhone: apt.ownerPhone,
          ownerEmail: apt.ownerEmail,
          residentName: apt.residentName,
          residentPhone: apt.residentPhone,
          residentEmail: apt.residentEmail,
          residentId: (apt as any).residentId || null,
          notes: (apt as any).notes || null,
          isActive: apt.isActive !== undefined ? apt.isActive : true,
        },
      });
    }

    // 2. Seed Individual Rooms for Apartment A-101 (exact 5 rooms from prompt)
    console.log('👉 Seeding 5 individual rooms for Apartment A-101...');
    const aptA101 = await prisma.apartment.findUnique({
      where: {
        buildingId_unitNumber: {
          buildingId: spanTower.id,
          unitNumber: 'A-101',
        },
      },
    });

    if (aptA101) {
      const fiveRooms = [
        { roomNumber: 'Bedroom 1', roomType: 'BEDROOM' as const, areaSqft: 150.00, maintenanceRate: 10.00 },
        { roomNumber: 'Bedroom 2', roomType: 'BEDROOM' as const, areaSqft: 120.00, maintenanceRate: 10.00 },
        { roomNumber: 'Living Room', roomType: 'LIVING_ROOM' as const, areaSqft: 220.00, maintenanceRate: 10.00 },
        { roomNumber: 'Kitchen', roomType: 'KITCHEN' as const, areaSqft: 100.00, maintenanceRate: 10.00 },
        { roomNumber: 'Bathroom', roomType: 'BATHROOM' as const, areaSqft: 40.00, maintenanceRate: 10.00 },
      ];

      for (const r of fiveRooms) {
        await prisma.apartmentRoom.upsert({
          where: {
            apartmentId_roomNumber: {
              apartmentId: aptA101.id,
              roomNumber: r.roomNumber,
            },
          },
          update: {
            areaSqft: r.areaSqft,
            maintenanceRate: r.maintenanceRate,
            roomType: r.roomType,
          },
          create: {
            organizationId: demoOrg.id,
            buildingId: spanTower.id,
            apartmentId: aptA101.id,
            roomNumber: r.roomNumber,
            roomType: r.roomType,
            areaSqft: r.areaSqft,
            maintenanceRate: r.maintenanceRate,
            isActive: true,
          },
        });
      }

      // Sync total apartment area = 150 + 120 + 220 + 100 + 40 = 630 sq. ft.
      await prisma.apartment.update({
        where: { id: aptA101.id },
        data: { areaSqft: 630.00 },
      });
      console.log('✅ Seeded 5 rooms (Total: 630 sq ft, Rs. 6,300/mo) for Unit A-101.');
    }

    // Create current billing period (October 2026)
    await prisma.billingPeriod.upsert({
      where: {
        buildingId_periodCode: {
          buildingId: spanTower.id,
          periodCode: '2026-10',
        },
      },
      update: {},
      create: {
        organizationId: demoOrg.id,
        buildingId: spanTower.id,
        name: 'October 2026',
        periodCode: '2026-10',
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-10-31T23:59:59Z'),
        dueDate: new Date('2026-10-25T23:59:59Z'),
        isClosed: false,
      },
    });

    console.log('✅ Span Tower IX hierarchy (Towers, Units, Rooms) seeded.');
  }

  console.log('🎉 Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
