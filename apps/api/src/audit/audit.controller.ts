import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit_logs.read')
  @ApiOperation({ summary: 'List audit logs within authorized scope' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const take = parseInt(limit, 10) || 50;
    const skip = parseInt(offset, 10) || 0;

    if (user.isPlatformAdmin && !organizationId) {
      return this.auditService.findPlatformLogs(take, skip);
    }

    // Tenant isolation: if not platform admin, enforce their authorized organization
    let targetOrgId = organizationId;
    if (!user.isPlatformAdmin) {
      const authorizedOrgIds = user.memberships
        .filter((m) => m.permissions.includes('audit_logs.read'))
        .map((m) => m.organizationId)
        .filter(Boolean) as string[];

      if (!targetOrgId || !authorizedOrgIds.includes(targetOrgId)) {
        targetOrgId = authorizedOrgIds[0];
      }
    }

    if (!targetOrgId) {
      return [];
    }

    return this.auditService.findByOrganization(targetOrgId, take, skip);
  }
}
