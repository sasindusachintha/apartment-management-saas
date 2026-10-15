import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Lock, AlertCircle, CheckCircle2, Loader2, User } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setError('Please provide current and new passwords');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setSuccess(data.message || 'Password successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Failed to update password';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', maxWidth: '800px' }}
    >
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
          Account & Security
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Manage your personal credentials, session tokens, and security profile
        </p>
      </div>

      {/* Account Info Card */}
      <div className="card">
        <h3
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '1.1rem',
            marginBottom: 'var(--space-4)',
          }}
        >
          <User size={18} color="var(--color-brand-400)" /> Profile Overview
        </h3>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}
        >
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Full Name
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.name}</div>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Email Address
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.email}</div>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Platform Privileges
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {user?.isPlatformAdmin ? 'PLATFORM ADMIN' : 'ORGANIZATION MEMBER'}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Account Status
            </div>
            <div>
              <span className="badge badge-success">{user?.status || 'ACTIVE'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Form */}
      <div className="card">
        <h3
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '1.1rem',
            marginBottom: 'var(--space-2)',
          }}
        >
          <KeyRound size={18} color="var(--color-brand-400)" /> Change Password
        </h3>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '0.85rem',
            marginBottom: 'var(--space-6)',
          }}
        >
          Updating your password will immediately revoke all active refresh tokens on all devices.
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              background: 'hsl(0, 84%, 15%)',
              border: '1px solid var(--color-danger-500)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              color: 'hsl(0, 100%, 90%)',
              fontSize: '0.85rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            <AlertCircle size={16} color="var(--color-danger-500)" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              background: 'hsl(142, 76%, 12%)',
              border: '1px solid var(--color-success-500)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              color: 'hsl(142, 100%, 90%)',
              fontSize: '0.85rem',
              marginBottom: 'var(--space-4)',
            }}
          >
            <CheckCircle2 size={16} color="var(--color-success-500)" />
            <span>{success}</span>
          </div>
        )}

        <form
          onSubmit={handlePasswordChange}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="cur-pass">
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                color="var(--color-text-muted)"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                id="cur-pass"
                type="password"
                className="input"
                style={{ paddingLeft: '40px' }}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-pass">
              New Password (minimum 8 characters)
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                color="var(--color-text-muted)"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                id="new-pass"
                type="password"
                className="input"
                style={{ paddingLeft: '40px' }}
                placeholder="Enter strong new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="conf-pass">
              Confirm New Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                color="var(--color-text-muted)"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                id="conf-pass"
                type="password"
                className="input"
                style={{ paddingLeft: '40px' }}
                placeholder="Confirm strong new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
