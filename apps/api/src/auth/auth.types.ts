export interface UserRoleMembership {
  id: string;
  roleId: string;
  roleName: string;
  organizationId: string | null;
  organizationName?: string | null;
  organizationSlug?: string | null;
  buildingId: string | null;
  permissions: string[];
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  status: string;
  isPlatformAdmin: boolean;
  memberships: UserRoleMembership[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  iat?: number;
  exp?: number;
}
