import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const THREE_ROLE_DEFINITIONS: Record<string, { description: string; permissions: string[] }> = {
  SUPER_ADMIN: {
    description: 'SaaS Platform Administrator with full system control',
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
    description: 'Building Owner managing assigned buildings, apartments, rooms, renters, and billing',
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

export async function migrateRoles() {
  console.log('🔄 Starting role normalization to EXACTLY THREE ROLES...');

  // 1. Ensure the 3 target roles exist in Role table
  const roleMap = new Map<string, string>();
  for (const [roleName, def] of Object.entries(THREE_ROLE_DEFINITIONS)) {
    const roleRecord = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: def.description },
      create: { name: roleName, description: def.description },
    });
    roleMap.set(roleName, roleRecord.id);

    // Sync permissions
    for (const permKey of def.permissions) {
      let perm = await prisma.permission.findUnique({ where: { key: permKey } });
      if (!perm) {
        perm = await prisma.permission.create({
          data: { key: permKey, description: `Permission for ${permKey}` },
        });
      }
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecord.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: roleRecord.id,
          permissionId: perm.id,
        },
      });
    }
  }

  const superAdminRoleId = roleMap.get('SUPER_ADMIN')!;
  const buildingOwnerRoleId = roleMap.get('BUILDING_OWNER')!;
  const renterRoleId = roleMap.get('RENTER')!;

  // 2. Fetch all existing roles
  const allRoles = await prisma.role.findMany();
  const oldRoleIds = new Map<string, string>();
  for (const r of allRoles) {
    oldRoleIds.set(r.name, r.id);
  }

  // 3. Migrate all user roles to the 3 target roles
  const allUserRoles = await prisma.userRole.findMany({
    include: { role: true, user: true },
  });

  console.log(`ℹ️ Inspecting ${allUserRoles.length} user-role assignments across all accounts...`);

  for (const ur of allUserRoles) {
    const currentRoleName = ur.role.name;

    if (currentRoleName === 'SUPER_ADMIN' || currentRoleName === 'BUILDING_OWNER' || currentRoleName === 'RENTER') {
      continue; // already one of the 3 roles
    }

    let targetRoleId = buildingOwnerRoleId;

    if (currentRoleName === 'PLATFORM_ADMIN') {
      targetRoleId = superAdminRoleId;
    } else if (currentRoleName === 'RESIDENT') {
      targetRoleId = renterRoleId;
    } else if (currentRoleName === 'MANAGER' || currentRoleName === 'OWNER' || currentRoleName === 'STAFF' || currentRoleName === 'ACCOUNTANT') {
      targetRoleId = buildingOwnerRoleId;
    }

    // Check if user already has this target role for this organization/building
    const existingTarget = await prisma.userRole.findFirst({
      where: {
        userId: ur.userId,
        roleId: targetRoleId,
        organizationId: ur.organizationId,
        buildingId: ur.buildingId,
      },
    });

    if (existingTarget) {
      // Remove redundant old role assignment
      await prisma.userRole.delete({ where: { id: ur.id } });
      console.log(`  Removed redundant role [${currentRoleName}] for user ${ur.user.email} (already has target role)`);
    } else {
      // Update to target role
      await prisma.userRole.update({
        where: { id: ur.id },
        data: { roleId: targetRoleId },
      });
      console.log(`  Migrated user ${ur.user.email}: [${currentRoleName}] -> [${THREE_ROLE_DEFINITIONS[Object.keys(THREE_ROLE_DEFINITIONS).find(k => roleMap.get(k) === targetRoleId)!]?.description || targetRoleId}]`);
    }
  }

  // 4. Clean up any remaining duplicate UserRole rows
  const remainingUserRoles = await prisma.userRole.findMany();
  const seenUserRoles = new Set<string>();
  for (const ur of remainingUserRoles) {
    const key = `${ur.userId}_${ur.roleId}_${ur.organizationId || 'null'}_${ur.buildingId || 'null'}`;
    if (seenUserRoles.has(key)) {
      await prisma.userRole.delete({ where: { id: ur.id } });
    } else {
      seenUserRoles.add(key);
    }
  }

  // 5. Update user display names to remove "(Manager)"
  const bobManager = await prisma.user.findUnique({ where: { email: 'manager@acme.com' } });
  if (bobManager && bobManager.name.includes('Manager')) {
    await prisma.user.update({
      where: { id: bobManager.id },
      data: { name: 'Bob Miller (Building Owner)' },
    });
  }

  // 6. Delete obsolete roles from role_permissions and roles
  const obsoleteRoleNames = ['PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'ACCOUNTANT', 'RESIDENT'];
  for (const obsName of obsoleteRoleNames) {
    const obsRole = await prisma.role.findUnique({ where: { name: obsName } });
    if (obsRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: obsRole.id } });
      await prisma.userRole.deleteMany({ where: { roleId: obsRole.id } });
      await prisma.role.delete({ where: { id: obsRole.id } });
      console.log(`  Removed obsolete role definition: ${obsName}`);
    }
  }

  console.log('✅ Role normalization complete! Active roles in system: SUPER_ADMIN, BUILDING_OWNER, RENTER.');
}

if (require.main === module) {
  migrateRoles()
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
