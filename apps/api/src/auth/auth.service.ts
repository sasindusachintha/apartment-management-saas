import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper to hash tokens (SHA-256) for secure database storage.
   */
  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a cryptographically strong random token.
   */
  public generateSecureToken(byteLength = 32): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * Resolves user memberships, roles, and permissions from the database.
   */
  public async getUserMemberships(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        organization: {
          select: { id: true, name: true, slug: true, status: true },
        },
        building: {
          select: { id: true, name: true, address: true },
        },
      },
    });

    // Resolve active apartment tenancy for renters
    const assignedApartment = (user?.email && this.prisma.apartment?.findFirst)
      ? await this.prisma.apartment.findFirst({
          where: {
            isActive: true,
            OR: [{ residentId: userId }, { residentEmail: user.email }],
          },
          include: {
            building: { select: { id: true, name: true } },
            tower: { select: { id: true, name: true } },
          },
        })
      : null;

    return userRoles.map((ur) => {
      let propertyTitle = ur.building?.name || ur.organization?.name || 'ApartmentSaaS Hub';
      if (assignedApartment) {
        propertyTitle = `${assignedApartment.building.name} • Unit ${assignedApartment.unitNumber}`;
      } else if (ur.building?.name) {
        propertyTitle = ur.building.name;
      }

      return {
        id: ur.id,
        roleId: ur.roleId,
        roleName: ur.role.name,
        organizationId: ur.organizationId,
        organizationName: ur.organization?.name ?? null,
        organizationSlug: ur.organization?.slug ?? null,
        buildingId: ur.buildingId,
        buildingName: ur.building?.name ?? null,
        propertyTitle,
        assignedUnitNumber: assignedApartment?.unitNumber ?? null,
        permissions: ur.role.rolePermissions.map((rp) => rp.permission.key),
      };
    });
  }

  /**
   * Login with email and password. Returns tokens, memberships, and user info.
   */
  async login(dto: LoginDto, context?: { ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    // Constant-time check / generic response to prevent email enumeration
    if (!user) {
      await this.auditService.log({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: null,
        metadata: { reason: 'User not found' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      await this.auditService.log({
        actorUserId: user.id,
        action: 'AUTH_LOGIN_BLOCKED',
        entityType: 'User',
        entityId: user.id,
        metadata: { status: user.status },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      await this.auditService.log({
        actorUserId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'Incorrect password' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const memberships = await this.getUserMemberships(user.id);
    const isPlatformAdmin = memberships.some(
      (m) => m.roleName === 'PLATFORM_ADMIN' || m.roleName === 'SUPER_ADMIN',
    );

    // Issue Access Token
    const jwtPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin,
    };
    const accessToken = this.jwtService.sign(jwtPayload);

    // Issue Refresh Token
    const rawRefreshToken = this.generateSecureToken(32);
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshExpiresInDays = 7;
    const expiresAt = new Date(Date.now() + refreshExpiresInDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent ? context.userAgent.substring(0, 255) : null,
      },
    });

    const csrfToken = this.generateSecureToken(16);

    await this.auditService.log({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      metadata: { isPlatformAdmin },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        isPlatformAdmin,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      csrfToken,
      memberships,
    };
  }

  /**
   * Refreshes access token with rotation and reuse detection.
   */
  async refreshTokens(
    rawRefreshToken: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh session');
    }

    // Reuse detection: If token was already revoked or replaced, revoke all sessions!
    if (storedToken.isRevoked || storedToken.replacedByTokenHash) {
      this.logger.warn(
        `🚨 Refresh token reuse detected for user ${storedToken.userId}. Revoking all sessions.`,
      );

      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { isRevoked: true },
      });

      await this.auditService.log({
        actorUserId: storedToken.userId,
        action: 'SECURITY_TOKEN_REUSE_DETECTED',
        entityType: 'RefreshToken',
        entityId: storedToken.id,
        metadata: { warning: 'All sessions revoked due to replay detection' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      throw new UnauthorizedException('Session invalidated due to suspicious activity');
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh session has expired');
    }

    if (storedToken.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    // Issue new rotated token
    const newRawRefreshToken = this.generateSecureToken(32);
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Invalidate old token and link to replacement in a transaction
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          isRevoked: true,
          replacedByTokenHash: newTokenHash,
        },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: newTokenHash,
          expiresAt,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent ? context.userAgent.substring(0, 255) : null,
        },
      }),
    ]);

    const memberships = await this.getUserMemberships(storedToken.userId);
    const isPlatformAdmin = memberships.some(
      (m) => m.roleName === 'PLATFORM_ADMIN' || m.roleName === 'SUPER_ADMIN',
    );

    const jwtPayload: JwtPayload = {
      sub: storedToken.user.id,
      email: storedToken.user.email,
      name: storedToken.user.name,
      isPlatformAdmin,
    };
    const accessToken = this.jwtService.sign(jwtPayload);
    const csrfToken = this.generateSecureToken(16);

    await this.auditService.log({
      actorUserId: storedToken.userId,
      action: 'AUTH_SESSION_RENEWED',
      entityType: 'RefreshToken',
      entityId: storedToken.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      csrfToken,
      user: {
        id: storedToken.user.id,
        name: storedToken.user.name,
        email: storedToken.user.email,
        phone: storedToken.user.phone,
        status: storedToken.user.status,
        isPlatformAdmin,
      },
      memberships,
    };
  }

  /**
   * Logs out user and invalidates the session server-side.
   */
  async logout(
    rawRefreshToken?: string,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }

    if (userId) {
      await this.auditService.log({
        actorUserId: userId,
        action: 'AUTH_LOGOUT',
        entityType: 'User',
        entityId: userId,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Changes authenticated user password and revokes all active refresh tokens.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentMatches = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!currentMatches) {
      throw new BadRequestException('Current password does not match');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      // Revoke all existing refresh sessions
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);

    await this.auditService.log({
      actorUserId: userId,
      action: 'USER_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }

  /**
   * Safe password reset request: returns generic message to avoid email enumeration.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const genericResponse = {
      message:
        'If that email address is registered, password reset instructions have been dispatched.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || user.status !== 'ACTIVE') {
      // Return identical response to prevent enumeration
      return genericResponse;
    }

    const rawResetToken = this.generateSecureToken(32);
    const tokenHash = this.hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    // Invalidate previous unused reset tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await this.auditService.log({
      actorUserId: user.id,
      action: 'USER_PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    // In dev mode, log token to server console for testing convenience
    if (this.configService.get('NODE_ENV') !== 'production') {
      this.logger.debug(`[DEV ONLY] Password reset token for ${user.email}: ${rawResetToken}`);
    }

    return genericResponse;
  }

  /**
   * Safe password reset execution using single-use short-lived token.
   */
  async resetPassword(dto: ResetPasswordDto, context?: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = this.hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all refresh sessions
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { isRevoked: true },
      }),
    ]);

    await this.auditService.log({
      actorUserId: record.userId,
      action: 'USER_PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: record.userId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { message: 'Password has been successfully reset. You may now log in.' };
  }

  /**
   * Returns current authenticated profile and organization memberships.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const memberships = await this.getUserMemberships(userId);
    const isPlatformAdmin = memberships.some(
      (m) =>
        (m.roleName === 'PLATFORM_ADMIN' || m.roleName === 'SUPER_ADMIN') &&
        m.organizationId === null,
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      isPlatformAdmin,
      memberships,
    };
  }
}
