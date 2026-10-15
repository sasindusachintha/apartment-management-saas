import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdminGuard } from './platform-admin.guard';
import { TenantGuard } from './tenant.guard';
import { PermissionsGuard } from './permissions.guard';
import { AuthenticatedUser } from '../auth.types';

function createMockContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('Multi-Tenant & Authorization Guards', () => {
  describe('PlatformAdminGuard', () => {
    const guard = new PlatformAdminGuard();

    it('should allow access to platform administrators', () => {
      const user: Partial<AuthenticatedUser> = {
        id: 'admin-1',
        isPlatformAdmin: true,
      };
      const context = createMockContext({ user });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access to ordinary organization users', () => {
      const user: Partial<AuthenticatedUser> = {
        id: 'owner-1',
        isPlatformAdmin: false,
      };
      const context = createMockContext({ user });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('TenantGuard (Cross-Tenant Isolation)', () => {
    const guard = new TenantGuard();

    it('should allow platform admin to access any organization', () => {
      const user: Partial<AuthenticatedUser> = {
        id: 'admin-1',
        isPlatformAdmin: true,
        memberships: [],
      };
      const context = createMockContext({
        user,
        params: { organizationId: 'org-tenant-b' },
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow organization member access to their authorized organization', () => {
      const user: Partial<AuthenticatedUser> = {
        id: 'member-1',
        isPlatformAdmin: false,
        memberships: [
          {
            id: 'ur-1',
            roleId: 'role-mgr',
            roleName: 'MANAGER',
            organizationId: 'org-tenant-a',
            buildingId: null,
            permissions: ['buildings.read'],
          },
        ],
      };
      const req: Record<string, unknown> = {
        user,
        params: { organizationId: 'org-tenant-a' },
      };
      const context = createMockContext(req);
      expect(guard.canActivate(context)).toBe(true);
      expect(req.tenantMembership).toBeDefined();
    });

    it('should REJECT cross-tenant access with non-disclosing 404 when tenant A user accesses tenant B', () => {
      const user: Partial<AuthenticatedUser> = {
        id: 'hacker-tenant-a',
        isPlatformAdmin: false,
        memberships: [
          {
            id: 'ur-1',
            roleId: 'role-owner',
            roleName: 'OWNER',
            organizationId: 'org-tenant-a', // Belongs to Org A
            buildingId: null,
            permissions: ['organizations.read', 'buildings.read'],
          },
        ],
      };
      const req = {
        user,
        params: { organizationId: 'org-tenant-b' }, // Attempts to access Org B!
      };
      const context = createMockContext(req);

      // Must throw NotFoundException (non-disclosing) to prevent organization enumeration
      expect(() => guard.canActivate(context)).toThrow(NotFoundException);
    });
  });

  describe('PermissionsGuard (RBAC Enforcement)', () => {
    let reflector: Reflector;
    let guard: PermissionsGuard;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new PermissionsGuard(reflector);
    });

    it('should grant access when user has required permission in tenant', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['buildings.read']);

      const user: Partial<AuthenticatedUser> = {
        id: 'user-1',
        isPlatformAdmin: false,
        memberships: [
          {
            id: 'ur-1',
            roleId: 'r-1',
            roleName: 'MANAGER',
            organizationId: 'org-1',
            buildingId: null,
            permissions: ['buildings.read', 'buildings.manage'],
          },
        ],
      };

      const context = createMockContext({
        user,
        tenantMembership: user.memberships![0],
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access when user lacks required permission', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['subscriptions.manage']);

      const user: Partial<AuthenticatedUser> = {
        id: 'staff-1',
        isPlatformAdmin: false,
        memberships: [
          {
            id: 'ur-staff',
            roleId: 'r-staff',
            roleName: 'STAFF',
            organizationId: 'org-1',
            buildingId: null,
            permissions: ['buildings.read'], // Missing subscriptions.manage!
          },
        ],
      };

      const context = createMockContext({
        user,
        tenantMembership: user.memberships![0],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
