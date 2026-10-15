import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldAlert,
  ShieldCheck,
  Bell,
  LogOut,
  Home,
  ChevronDown,
  Building,
  KeyRound,
  CheckCircle,
  FileText,
  CreditCard,
  Droplets,
  Clock,
  TrendingUp,
  Sliders,
  Receipt,
  LayoutGrid,
  Sun,
  Moon,
} from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const {
    user,
    activeOrg,
    organizations,
    setActiveOrgId,
    propertyTitle,
    logout,
    hasRole,
    isSessionExpired,
    dismissSessionExpired,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isSuperAdmin = !!user?.isPlatformAdmin || hasRole('SUPER_ADMIN');
  const isOwner = hasRole('BUILDING_OWNER') && !isSuperAdmin;
  const isRenter = hasRole('RENTER') && !isSuperAdmin && !isOwner;

  const roleDisplay = isSuperAdmin
    ? 'SUPER ADMIN'
    : isOwner
    ? 'BUILDING OWNER'
    : isRenter
    ? 'RENTER'
    : 'BUILDING OWNER';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="dashboard-layout">
      {/* Session Expired Modal */}
      {isSessionExpired && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              maxWidth: '420px',
              textAlign: 'center',
            }}
          >
            <ShieldAlert
              size={36}
              color="var(--color-warning-500)"
              style={{ margin: '0 auto var(--space-3)' }}
            />
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Session Expired</h3>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                marginBottom: 'var(--space-4)',
              }}
            >
              Your authentication session has ended or was invalidated. Please sign in again.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => {
                dismissSessionExpired();
                navigate('/login');
              }}
            >
              Sign In Again
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">
            <Home size={18} color="white" />
          </div>
          <span className="sidebar__logo-text">ApartmentSaaS</span>
        </div>

        {/* Real Property / Building Scope Identification */}
        <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
          {isRenter ? (
            <div
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Building size={16} color="var(--color-brand-400)" style={{ flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                  title={propertyTitle}
                >
                  {propertyTitle}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  Assigned Residence
                </div>
              </div>
            </div>
          ) : isSuperAdmin ? (
            <div
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldCheck size={16} color="var(--color-brand-400)" style={{ flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  ApartmentSaaS Platform
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-brand-400)' }}>
                  Super Admin Console
                </div>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  background: 'var(--color-surface-2)',
                }}
                onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}
                >
                  <Building2 size={16} color="var(--color-brand-400)" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                    title={propertyTitle}
                  >
                    {propertyTitle}
                  </span>
                </div>
                {organizations.length > 1 && <ChevronDown size={14} />}
              </button>

              {orgDropdownOpen && organizations.length > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        background:
                          org.id === activeOrg?.id ? 'var(--color-surface-2)' : 'transparent',
                        border: 'none',
                        color: 'var(--color-text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onClick={() => {
                        setActiveOrgId(org.id);
                        setOrgDropdownOpen(false);
                      }}
                    >
                      <span>{org.name}</span>
                      {org.id === activeOrg?.id && (
                        <CheckCircle size={14} color="var(--color-brand-400)" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="sidebar__nav">
          {isRenter ? (
            <>
              <span className="sidebar__section-label">My Residence</span>
              <NavLink
                to="/dashboard/my-apartment"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Home size={18} /> My Apartment
              </NavLink>

              <span className="sidebar__section-label">My Bills & Statements</span>
              <NavLink
                to="/dashboard/invoices"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <FileText size={18} /> Invoices & Bills
              </NavLink>

              <NavLink
                to="/dashboard/payments"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <CreditCard size={18} /> Payment Receipts
              </NavLink>

              <NavLink
                to="/dashboard/arrears"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Clock size={18} /> Outstanding Dues
              </NavLink>

              <span className="sidebar__section-label">My Profile</span>
              <NavLink
                to="/dashboard/settings"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <KeyRound size={18} /> Security & Account
              </NavLink>
            </>
          ) : isSuperAdmin ? (
            <>
              <span className="sidebar__section-label">Platform Control</span>
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <LayoutDashboard size={18} /> Platform Overview
              </NavLink>

              <NavLink
                to="/dashboard/owners"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <ShieldCheck size={18} /> Building Owners
              </NavLink>

              <NavLink
                to="/dashboard/renters"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Users size={18} /> Renters & Occupants
              </NavLink>

              <NavLink
                to="/dashboard/buildings"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Building2 size={18} /> Buildings
              </NavLink>

              <NavLink
                to="/dashboard/building-layout"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <LayoutGrid size={18} /> Building Layout Map
              </NavLink>

              <NavLink
                to="/dashboard/apartments"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Building size={18} /> All Apartments
              </NavLink>

              <span className="sidebar__section-label">Billing & Invoices</span>
              <NavLink
                to="/dashboard/monthly-billing"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Receipt size={18} /> Monthly Billing
              </NavLink>

              <NavLink
                to="/dashboard/invoices"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <FileText size={18} /> Invoices
              </NavLink>

              <NavLink
                to="/dashboard/payments"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <CreditCard size={18} /> Payments & Receipts
              </NavLink>

              <NavLink
                to="/dashboard/arrears"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Clock size={18} /> Arrears Ageing
              </NavLink>

              <span className="sidebar__section-label">Platform Admin</span>
              <NavLink
                to="/dashboard/reports"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <TrendingUp size={18} /> Financial Reports
              </NavLink>

              <NavLink
                to="/dashboard/audit"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <ShieldAlert size={18} /> Audit Trail
              </NavLink>

              <NavLink
                to="/dashboard/settings"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <KeyRound size={18} /> Security & Settings
              </NavLink>
            </>
          ) : (
            // BUILDING_OWNER
            <>
              <span className="sidebar__section-label">My Properties</span>
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <LayoutDashboard size={18} /> Overview
              </NavLink>

              <NavLink
                to="/dashboard/buildings"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Building2 size={18} /> My Buildings
              </NavLink>

              <NavLink
                to="/dashboard/building-layout"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <LayoutGrid size={18} /> Building Layout Map
              </NavLink>

              <NavLink
                to="/dashboard/apartments"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Building size={18} /> Apartments & Rooms
              </NavLink>

              <NavLink
                to="/dashboard/renters"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Users size={18} /> Renters & Tenancies
              </NavLink>

              <span className="sidebar__section-label">Billing & Utilities</span>
              <NavLink
                to="/dashboard/monthly-billing"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Receipt size={18} /> Monthly Billing
              </NavLink>

              <NavLink
                to="/dashboard/water-readings"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Droplets size={18} /> Water Readings
              </NavLink>

              <NavLink
                to="/dashboard/invoices"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <FileText size={18} /> Invoices
              </NavLink>

              <NavLink
                to="/dashboard/payments"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <CreditCard size={18} /> Payments & Receipts
              </NavLink>

              <NavLink
                to="/dashboard/arrears"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Clock size={18} /> Arrears Ageing
              </NavLink>

              <span className="sidebar__section-label">Settings</span>
              <NavLink
                to="/dashboard/reports"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <TrendingUp size={18} /> Financial Reports
              </NavLink>

              <NavLink
                to="/dashboard/billing-settings"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <Sliders size={18} /> Billing Settings
              </NavLink>

              <NavLink
                to="/dashboard/settings"
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <KeyRound size={18} /> Security & Account
              </NavLink>
            </>
          )}
        </nav>

        {/* User Profile Footer */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.name || 'User'}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-brand-400)',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {roleDisplay}
            </div>
          </div>
          <button
            className="btn-ghost"
            aria-label="Sign out"
            title="Sign out"
            disabled={isLoggingOut}
            onClick={handleLogout}
            style={{ padding: 'var(--space-2)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
            <h1
              className="topbar__title"
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '450px',
              }}
              title={propertyTitle}
            >
              {propertyTitle}
            </h1>
            <span
              className="badge badge-brand"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', flexShrink: 0 }}
            >
              {roleDisplay}
            </span>
          </div>

          <div className="topbar__actions">
            {/* Theme Switcher Button */}
            <button
              className="btn btn-outline"
              onClick={toggleTheme}
              style={{
                padding: '0.45rem 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
              }}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <>
                  <Moon size={15} color="var(--color-brand-500)" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun size={15} color="#eab308" />
                  <span>Light Mode</span>
                </>
              )}
            </button>

            <button
              className="btn btn-outline"
              style={{ padding: '0.5rem 0.75rem' }}
              aria-label="Notifications"
            >
              <Bell size={16} />
            </button>
            <div className="avatar" title={user?.email}>
              {initials}
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
