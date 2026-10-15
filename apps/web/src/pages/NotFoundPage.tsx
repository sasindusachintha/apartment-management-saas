import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-8)',
        background: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          fontSize: '8rem',
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          lineHeight: 1,
          background: 'linear-gradient(135deg, var(--color-brand-400), var(--color-accent-400))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 'var(--space-4)',
        }}
      >
        404
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)',
        }}
      >
        Page Not Found
      </h1>
      <p
        style={{
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-8)',
          maxWidth: '400px',
        }}
      >
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary" id="not-found-home-btn">
        <Home size={16} />
        Back to Home
      </Link>
    </div>
  );
}
