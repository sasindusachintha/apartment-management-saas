import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Home, Lock, Key, AlertCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword) {
      setError('Please provide the reset token and your new password');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Invalid or expired password reset token';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, hsl(239, 84%, 12%), var(--color-bg) 70%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background:
                'linear-gradient(135deg, var(--color-brand-500), var(--color-accent-500))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Home size={24} color="white" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
            }}
          >
            Set New Password
          </h1>
          <p
            style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}
          >
            Enter your reset token and choose a strong password
          </p>
        </div>

        {success ? (
          <div
            style={{
              background: 'hsl(142, 76%, 10%)',
              border: '1px solid var(--color-success-500)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <CheckCircle2 size={36} color="var(--color-success-500)" />
            <h3 style={{ color: 'var(--color-text-primary)' }}>Password Reset Successful</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              Your password has been securely updated and all previous sessions revoked.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 'var(--space-4)', width: '100%' }}
              onClick={() => navigate('/login')}
            >
              Sign In With New Password
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  background: 'hsl(0, 84%, 15%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  color: 'hsl(0, 100%, 90%)',
                  fontSize: '0.85rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={18} color="var(--color-danger-500)" style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="reset-token">
                  Reset Token
                </label>
                <div style={{ position: 'relative' }}>
                  <Key
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
                    id="reset-token"
                    type="text"
                    className="input"
                    style={{ paddingLeft: '40px', fontFamily: 'monospace' }}
                    placeholder="Paste 64-character token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-password">
                  New Password (min 8 characters)
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
                    id="new-password"
                    type="password"
                    className="input"
                    style={{ paddingLeft: '40px' }}
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">
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
                    id="confirm-password"
                    type="password"
                    className="input"
                    style={{ paddingLeft: '40px' }}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Resetting password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
                <Link
                  to="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                  }}
                >
                  <ArrowLeft size={16} /> Cancel & return to sign in
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
