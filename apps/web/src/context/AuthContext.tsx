import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api, setAccessToken, onSessionExpired } from '../lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  isPlatformAdmin: boolean;
}

export interface UserRoleMembership {
  id: string;
  roleId: string;
  roleName: string;
  organizationId: string | null;
  organizationName?: string | null;
  organizationSlug?: string | null;
  buildingId: string | null;
  buildingName?: string | null;
  propertyTitle?: string | null;
  assignedUnitNumber?: string | null;
  permissions: string[];
}

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
  role: string;
  buildingName?: string | null;
  propertyTitle?: string | null;
  assignedUnitNumber?: string | null;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  memberships: UserRoleMembership[];
  activeOrg: OrganizationContext | null;
  organizations: OrganizationContext[];
  propertyTitle: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveOrgId: (orgId: string) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<UserRoleMembership[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Compute available organizations from memberships
  const organizations = useMemo(() => {
    const orgMap = new Map<string, OrganizationContext>();
    for (const m of memberships) {
      if (m.organizationId && m.organizationName && m.organizationSlug) {
        if (!orgMap.has(m.organizationId)) {
          orgMap.set(m.organizationId, {
            id: m.organizationId,
            name: m.propertyTitle || m.organizationName,
            slug: m.organizationSlug,
            role: m.roleName,
            buildingName: m.buildingName,
            propertyTitle: m.propertyTitle,
            assignedUnitNumber: m.assignedUnitNumber,
            permissions: m.permissions,
          });
        }
      }
    }
    return Array.from(orgMap.values());
  }, [memberships]);

  const activeOrg = useMemo(() => {
    if (activeOrgId) {
      const found = organizations.find((o) => o.id === activeOrgId);
      if (found) return found;
    }
    return organizations[0] || null;
  }, [organizations, activeOrgId]);

  const propertyTitle = useMemo(() => {
    if (user?.isPlatformAdmin || memberships.some((m) => m.roleName === 'SUPER_ADMIN' || m.roleName === 'PLATFORM_ADMIN')) {
      return 'ApartmentSaaS Platform';
    }
    const primary = memberships[0];
    if (primary?.propertyTitle) return primary.propertyTitle;
    if (primary?.buildingName) return primary.buildingName;
    if (activeOrg?.propertyTitle) return activeOrg.propertyTitle;
    if (activeOrg?.name) return activeOrg.name;
    return 'My Apartment';
  }, [user, memberships, activeOrg]);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
  }, []);

  // Sync session state from /auth/refresh on initial app load
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (isMounted) {
          setAccessToken(data.accessToken);
          setUser(data.user);
          setMemberships(data.memberships);
          if (data.memberships.length > 0 && data.memberships[0].organizationId) {
            setActiveOrgIdState(data.memberships[0].organizationId);
          }
        }
      } catch {
        if (isMounted) {
          setAccessToken(null);
          setUser(null);
          setMemberships([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    onSessionExpired(() => {
      if (isMounted) {
        setUser(null);
        setMemberships([]);
        setAccessToken(null);
        setIsSessionExpired(true);
      }
    });

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      setMemberships(data.memberships);
      setIsSessionExpired(false);
      if (data.memberships.length > 0 && data.memberships[0].organizationId) {
        setActiveOrgIdState(data.memberships[0].organizationId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      setUser(null);
      setMemberships([]);
      setActiveOrgIdState(null);
    }
  };

  const hasPermission = useCallback(
    (permission: string) => {
      if (user?.isPlatformAdmin) return true;
      if (!activeOrg) return false;
      return activeOrg.permissions.includes(permission);
    },
    [user, activeOrg],
  );

  const hasRole = useCallback(
    (role: string) => {
      if (role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN') {
        return !!user?.isPlatformAdmin || memberships.some((m) => m.roleName === 'PLATFORM_ADMIN' || m.roleName === 'SUPER_ADMIN');
      }
      if (memberships.some((m) => m.roleName === role)) return true;
      if (!activeOrg) return false;
      return activeOrg.role === role;
    },
    [user, activeOrg, memberships],
  );

  const dismissSessionExpired = () => setIsSessionExpired(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeOrg,
        organizations,
        propertyTitle,
        isLoading,
        isAuthenticated: !!user,
        isSessionExpired,
        login,
        logout,
        setActiveOrgId,
        hasPermission,
        hasRole,
        dismissSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
