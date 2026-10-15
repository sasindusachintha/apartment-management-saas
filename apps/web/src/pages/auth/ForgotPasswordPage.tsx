import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Home, Mail, ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setSubmittedMessage(data.message);
    } catch {
      // Generic message even on error
      setSubmittedMessage(
        'If that email address is registered, password reset instructions have been dispatched.',
      );
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
            Reset Your Password
          </h1>
          <p
            style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}
          >
            Enter your email to receive a secure single-use reset token
          </p>
        </div>

        {submittedMessage ? (
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
            <p style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
              {submittedMessage}
            </p>
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
              <Link
                to="/reset-password"
                className="btn btn-outline"
                style={{ fontSize: '0.85rem' }}
              >
                Enter Reset Token
              </Link>
              <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">
                Registered Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
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
                  id="reset-email"
                  type="email"
                  className="input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  Sending instructions...
                </>
              ) : (
                <>
                  Send Reset Link <ArrowRight size={16} />
                </>
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
                <ArrowLeft size={16} /> Return to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
