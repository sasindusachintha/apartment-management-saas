import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogParams {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // Blacklist to prevent credentials or sensitive data from ever entering audit logs
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'currentpassword',
    'newpassword',
    'token',
    'refreshtoken',
    'tokenhash',
    'secret',
    'creditcard',
    'authorization',
    'cookie',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitizes structured metadata to guarantee credentials or tokens are never logged.
   */
  private sanitizeMetadata(
    data: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (AuditService.SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        clean[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  async log(params: CreateAuditLogParams) {
    try {
      const sanitizedMeta = this.sanitizeMetadata(params.metadata);

      return await this.prisma.auditLog.create({
        data: {
          organizationId: params.organizationId ?? null,
          actorUserId: params.actorUserId ?? null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId ?? null,
          metadata: (sanitizedMeta as unknown as object) ?? undefined,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ? params.userAgent.substring(0, 255) : null,
        },
      });
    } catch (error) {
      // Never let an audit logging failure crash the primary business operation
      this.logger.error(`Failed to record audit log [${params.action}]:`, error);
      return null;
    }
  }

  async findByOrganization(organizationId: string, limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      include: {
        actorUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });
  }

  async findPlatformLogs(limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        actorUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });
  }
}
