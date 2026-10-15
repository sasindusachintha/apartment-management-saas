import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Building2 } from 'lucide-react';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user, activeOrg, organizations, setActiveOrgId } = useAuth();

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            background: 'hsl(0, 84%, 15%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-4)',
          }}
        >
          <ShieldAlert size={32} color="var(--color-danger-500)" />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Access Denied (403)
        </h1>

        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '0.9rem',
            marginBottom: 'var(--space-6)',
          }}
        >
          You do not possess the required permissions or role in{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {activeOrg?.name || 'this organization'}
          </strong>{' '}
          to view or modify this resource.
        </p>

        {user && (
          <div
            style={{
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              textAlign: 'left',
              marginBottom: 'var(--space-6)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Current User: <span style={{ color: 'var(--color-text-primary)' }}>{user.name}</span>{' '}
              ({user.email})
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>
              Assigned Role:{' '}
              <span className="badge badge-primary" style={{ marginLeft: '4px' }}>
                {user.isPlatformAdmin ? 'PLATFORM_ADMIN' : activeOrg?.role || 'No Role'}
              </span>
            </div>
          </div>
        )}

        {organizations.length > 1 && (
          <div style={{ marginBottom: 'var(--space-6)', textAlign: 'left' }}>
            <label className="form-label">Switch to another organization:</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  className={`btn ${org.id === activeOrg?.id ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => {
                    setActiveOrgId(org.id);
                    navigate('/dashboard');
                  }}
                >
                  <Building2 size={14} /> {org.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
          <button className="btn btn-outline" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Go Back
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} /> Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
