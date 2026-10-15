import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  ShieldCheck,
  BarChart3,
  Bell,
  Key,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

const features = [
  {
    icon: Building2,
    title: 'Property Management',
    desc: 'Manage all your properties, units, and maintenance requests from one unified dashboard.',
    color: 'hsl(239, 84%, 60%)',
    bg: 'hsl(239, 84%, 60%, 0.1)',
  },
  {
    icon: Users,
    title: 'Tenant Portal',
    desc: 'Self-service portal for tenants to pay rent, submit requests, and view lease documents.',
    color: 'hsl(265, 89%, 62%)',
    bg: 'hsl(265, 89%, 62%, 0.1)',
  },
  {
    icon: BarChart3,
    title: 'Revenue Analytics',
    desc: 'Real-time insights on occupancy, revenue trends, and portfolio performance.',
    color: 'hsl(142, 76%, 36%)',
    bg: 'hsl(142, 76%, 36%, 0.1)',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    desc: 'Automated alerts for lease renewals, maintenance, late payments, and more.',
    color: 'hsl(38, 92%, 50%)',
    bg: 'hsl(38, 92%, 50%, 0.1)',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Access',
    desc: 'Granular permissions for admins, property managers, and tenants.',
    color: 'hsl(0, 84%, 60%)',
    bg: 'hsl(0, 84%, 60%, 0.1)',
  },
  {
    icon: Key,
    title: 'Digital Leasing',
    desc: 'Create, manage, and sign leases digitally with full audit trails.',
    color: 'hsl(200, 80%, 50%)',
    bg: 'hsl(200, 80%, 50%, 0.1)',
  },
];

const stats = [
  { value: '12K+', label: 'Units Managed' },
  { value: '98%', label: 'Uptime SLA' },
  { value: '3min', label: 'Avg. Response Time' },
  { value: '500+', label: 'Property Managers' },
];

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav__inner">
          <div className="landing-nav__logo">
            <div className="landing-nav__logo-icon">
              <Building2 size={20} color="white" />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--color-text-primary)',
              }}
            >
              ApartmentSaaS
            </span>
          </div>

          <div className="landing-nav__links">
            <a href="#features" className="landing-nav__link">
              Features
            </a>
            <a href="#pricing" className="landing-nav__link">
              Pricing
            </a>
            <a href="#about" className="landing-nav__link">
              About
            </a>
            <a href="#contact" className="landing-nav__link">
              Contact
            </a>
          </div>

          <div className="landing-nav__actions">
            <Link to="/login" className="btn btn-outline" style={{ fontSize: '0.875rem' }}>
              Sign In
            </Link>
            <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="animate-fade-in-up">
            <div className="hero__eyebrow">
              <Sparkles size={12} />
              The future of property management
            </div>
          </div>

          <h1 className="hero__title animate-fade-in-up delay-100">
            Manage Your <span className="gradient-text">Entire Portfolio</span>
            <br />
            In One Place
          </h1>

          <p className="hero__subtitle animate-fade-in-up delay-200">
            ApartmentSaaS gives property managers and landlords a complete platform to manage units,
            tenants, leases, and maintenance — beautifully.
          </p>

          <div className="hero__cta animate-fade-in-up delay-300">
            <Link to="/dashboard" className="btn btn-primary" id="hero-get-started-btn">
              Start Free Trial
              <ArrowRight size={16} />
            </Link>
            <Link to="/dashboard" className="btn btn-outline" id="hero-demo-btn">
              View Dashboard Demo
            </Link>
          </div>

          <div className="hero__stats animate-fade-in-up delay-400">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}
              >
                {i > 0 && <div className="hero__stat-divider" />}
                <div>
                  <div className="hero__stat-value">{stat.value}</div>
                  <div className="hero__stat-label">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="container">
          <div style={{ textAlign: 'center' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Everything you need to <span className="gradient-text">scale your portfolio</span>
            </h2>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '1.05rem',
                maxWidth: '580px',
                margin: '0 auto',
              }}
            >
              From single-unit landlords to enterprise property groups, ApartmentSaaS grows with
              you.
            </p>
          </div>

          <div className="features__grid">
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="feature-card">
                <div className="feature-card__icon" style={{ background: bg }}>
                  <Icon size={24} color={color} />
                </div>
                <h3 className="feature-card__title">{title}</h3>
                <p className="feature-card__desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-banner" id="pricing">
        <div className="container">
          <div className="cta-banner__inner">
            <h2 className="cta-banner__title">
              Ready to transform your <span className="gradient-text">property business?</span>
            </h2>
            <p className="cta-banner__subtitle">
              Join 500+ property managers already using ApartmentSaaS. No credit card required.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--space-4)',
                flexWrap: 'wrap',
                position: 'relative',
              }}
            >
              <Link to="/dashboard" className="btn btn-primary" id="cta-trial-btn">
                Start Your Free Trial
                <ArrowRight size={16} />
              </Link>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--space-6)',
                marginTop: 'var(--space-8)',
                flexWrap: 'wrap',
                position: 'relative',
              }}
            >
              {['No credit card required', '14-day free trial', 'Cancel anytime'].map((text) => (
                <span
                  key={text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: '0.85rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <CheckCircle2 size={14} color="hsl(142, 76%, 36%)" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer__inner">
            <p className="footer__copy">
              © {new Date().getFullYear()} ApartmentSaaS. All rights reserved.
            </p>
            <div className="footer__links">
              <a href="#" className="footer__link">
                Privacy
              </a>
              <a href="#" className="footer__link">
                Terms
              </a>
              <a href="#" className="footer__link">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
