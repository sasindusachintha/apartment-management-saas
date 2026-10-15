import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService & Security Tests', () => {
  let authService: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  const mockJwtService = {
    sign: jest.fn(() => 'mock_access_jwt_token_12345'),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      return null;
    }),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('1. Password Hashing & Verification (Argon2id)', () => {
    it('should hash passwords using Argon2id and verify correctly', async () => {
      const password = 'SuperSecret123!';
      const hash = await argon2.hash(password);

      expect(hash).toContain('$argon2id$');

      const matches = await argon2.verify(hash, password);
      expect(matches).toBe(true);

      const wrongMatches = await argon2.verify(hash, 'WrongPassword123!');
      expect(wrongMatches).toBe(false);
    });
  });

  describe('2. Login Success and Failure (Non-disclosing)', () => {
    it('should succeed with valid email and password', async () => {
      const password = 'UserSecure123!';
      const passwordHash = await argon2.hash(password);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        passwordHash,
        status: 'ACTIVE',
      });

      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          id: 'ur-1',
          roleId: 'role-owner',
          organizationId: 'org-1',
          role: { name: 'OWNER', rolePermissions: [{ permission: { key: 'buildings.read' } }] },
          organization: { name: 'Acme', slug: 'acme' },
        },
      ]);

      const result = await authService.login({
        email: 'alice@example.com',
        password,
      });

      expect(result.accessToken).toBe('mock_access_jwt_token_12345');
      expect(result.refreshToken).toBeDefined();
      expect(result.csrfToken).toBeDefined();
      expect(result.user.email).toBe('alice@example.com');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS', actorUserId: 'user-1' }),
      );
    });

    it('should reject non-existent user with generic 401 error', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGIN_FAILED' }),
      );
    });

    it('should reject wrong password with generic 401 error', async () => {
      const realHash = await argon2.hash('RealPassword123!');
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'bob@example.com',
        passwordHash: realHash,
        status: 'ACTIVE',
      });

      await expect(
        authService.login({
          email: 'bob@example.com',
          password: 'IncorrectPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGIN_FAILED' }),
      );
    });

    it('should reject suspended user with generic 401 error', async () => {
      const realHash = await argon2.hash('RealPassword123!');
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-3',
        email: 'suspended@example.com',
        passwordHash: realHash,
        status: 'SUSPENDED',
      });

      await expect(
        authService.login({
          email: 'suspended@example.com',
          password: 'RealPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('3. Session Renewal, Expiration & Reuse Detection', () => {
    it('should rotate token upon valid refresh request', async () => {
      const rawToken = 'valid_raw_token_abc123';
      const tokenHash = authService.hashToken(rawToken);

      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash,
        isRevoked: false,
        replacedByTokenHash: null,
        expiresAt: new Date(Date.now() + 1000000),
        user: { id: 'user-1', name: 'Alice', email: 'alice@example.com', status: 'ACTIVE' },
      });

      mockPrismaService.userRole.findMany.mockResolvedValue([]);

      const result = await authService.refreshTokens(rawToken);

      expect(result.accessToken).toBe('mock_access_jwt_token_12345');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(rawToken); // rotated!
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should trigger reuse detection and revoke ALL sessions if revoked token is presented', async () => {
      const replayedToken = 'stolen_or_already_used_token';
      const tokenHash = authService.hashToken(replayedToken);

      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        userId: 'user-victim',
        tokenHash,
        isRevoked: true, // ALREADY REVOKED!
        replacedByTokenHash: 'some_newer_hash',
        expiresAt: new Date(Date.now() + 1000000),
        user: { id: 'user-victim', status: 'ACTIVE' },
      });

      await expect(authService.refreshTokens(replayedToken)).rejects.toThrow(UnauthorizedException);

      // Verify that all sessions for this user were immediately invalidated
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-victim' },
        data: { isRevoked: true },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SECURITY_TOKEN_REUSE_DETECTED' }),
      );
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = 'expired_token_123';
      const tokenHash = authService.hashToken(expiredToken);

      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-exp',
        userId: 'user-1',
        tokenHash,
        isRevoked: false,
        expiresAt: new Date(Date.now() - 10000), // Expired!
        user: { id: 'user-1', status: 'ACTIVE' },
      });

      await expect(authService.refreshTokens(expiredToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('4. Logout and Server-Side Session Invalidation', () => {
    it('should invalidate refresh token on logout', async () => {
      const rawToken = 'active_token_to_logout';
      const tokenHash = authService.hashToken(rawToken);

      await authService.logout(rawToken, 'user-1');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash },
        data: { isRevoked: true },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGOUT', actorUserId: 'user-1' }),
      );
    });
  });

  describe('5. Password Reset Workflow (Single-Use Short-Lived Tokens)', () => {
    it('forgotPassword should return generic message for both valid and invalid email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const res1 = await authService.forgotPassword({ email: 'ghost@example.com' });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-real',
        email: 'real@example.com',
        status: 'ACTIVE',
      });
      const res2 = await authService.forgotPassword({ email: 'real@example.com' });

      expect(res1.message).toEqual(res2.message); // IDENTICAL non-disclosing message!
    });

    it('resetPassword should reject invalid or expired reset token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: 'invalid_token',
          newPassword: 'NewStrongPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resetPassword should reject already-used reset token', async () => {
      const token = 'already_used_token';
      const tokenHash = authService.hashToken(token);

      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 600000),
        usedAt: new Date(), // Already used!
      });

      await expect(
        authService.resetPassword({
          token,
          newPassword: 'NewStrongPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resetPassword should update password and revoke all active sessions on valid token', async () => {
      const token = 'valid_single_use_token';
      const tokenHash = authService.hashToken(token);

      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue({
        id: 'prt-2',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
      });

      const res = await authService.resetPassword({
        token,
        newPassword: 'BrandNewSecurePassword123!',
      });

      expect(res.message).toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_PASSWORD_RESET_COMPLETED' }),
      );
    });
  });
});
