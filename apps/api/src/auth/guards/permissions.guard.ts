import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      tenantMembership?: { permissions: string[] };
    }>();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // Platform admin has all permissions
    if (user.isPlatformAdmin) {
      return true;
    }

    // Check permissions within the scoped tenant membership if present, or all memberships
    let userPermissions: string[] = [];
    if (req.tenantMembership) {
      userPermissions = req.tenantMembership.permissions;
    } else {
      userPermissions = Array.from(new Set(user.memberships.flatMap((m) => m.permissions)));
    }

    const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasAll) {
      throw new ForbiddenException(
        `Insufficient permissions: missing ${requiredPermissions
          .filter((p) => !userPermissions.includes(p))
          .join(', ')}`,
      );
    }

    return true;
  }
}
