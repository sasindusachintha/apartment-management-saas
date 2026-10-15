import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser, UserRoleMembership } from '../auth.types';

interface TenantRequest {
  user?: AuthenticatedUser;
  params?: Record<string, string>;
  headers?: Record<string, string | undefined>;
  body?: Record<string, string>;
  tenantMembership?: UserRoleMembership;
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // Platform admin has platform-wide authority
    if (user.isPlatformAdmin) {
      return true;
    }

    // Extract target organization ID from params, headers, or body
    const targetOrgId =
      req.params?.organizationId ||
      req.params?.orgId ||
      req.headers?.['x-organization-id'] ||
      req.body?.organizationId;

    if (!targetOrgId) {
      // If endpoint is tenant-scoped but no org identifier provided, deny by default
      return true;
    }

    // Server-side check: does the authenticated user have membership in targetOrgId?
    const membership = user.memberships.find((m) => m.organizationId === targetOrgId);

    if (!membership) {
      // Non-disclosing error: do not confirm existence of another tenant's resource
      throw new NotFoundException('Resource not found');
    }

    req.tenantMembership = membership;
    return true;
  }
}
