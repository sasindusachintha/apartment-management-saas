import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request): string | null =>
          typeof req?.cookies?.['access_token'] === 'string' ? req.cookies['access_token'] : null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'app.jwt.secret',
        'dev_secret_replace_this_in_production_with_64_char_random',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
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
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is invalid or deactivated');
    }

    const memberships = user.userRoles.map((ur) => ({
      id: ur.id,
      roleId: ur.roleId,
      roleName: ur.role.name,
      organizationId: ur.organizationId,
      organizationName: ur.organization?.name ?? null,
      organizationSlug: ur.organization?.slug ?? null,
      buildingId: ur.buildingId,
      permissions: ur.role.rolePermissions.map((rp) => rp.permission.key),
    }));

    const isPlatformAdmin = memberships.some(
      (m) => m.roleName === 'PLATFORM_ADMIN' || m.roleName === 'SUPER_ADMIN',
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      isPlatformAdmin,
      memberships,
    };
  }
}
