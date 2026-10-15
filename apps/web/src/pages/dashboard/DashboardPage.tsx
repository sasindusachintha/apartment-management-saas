import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Percent,
  Building2,
  FileText,
  CreditCard,
  Droplets,
  PlusCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface CollectionReport {
  periodCode?: string;
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionRatePercent: number;
  invoicesCount: number;
  paidInvoicesCount: number;
  partialInvoicesCount: number;
  unpaidInvoicesCount: number;
  byPaymentMethod?: Record<string, number>;
}

interface ArrearsSummary {
  totalArrears: number;
  overdueAmount: number;
  totalApartmentsWithArrears: number;
}

interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  apartment: {
    unitNumber: string;
    residentName?: string | null;
    ownerName?: string | null;
  };
  period: {
    periodCode: string;
  };
  dueDate: string;
  totalAmount: number;
  balanceAmount: number;
  status: string;
}

interface Building {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const { user, activeOrg, hasPermission, hasRole } = useAuth();

  const isSuperAdmin = !!user?.isPlatformAdmin || hasRole('SUPER_ADMIN');
  const isOwner = hasRole('BUILDING_OWNER');
  const isRenter = hasRole('RENTER') && !isSuperAdmin && !isOwner;

  if (isRenter) {
    return <Navigate to="/dashboard/my-apartment" replace />;
  }

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [collection, setCollection] = useState<CollectionReport | null>(null);
  const [arrears, setArrears] = useState<ArrearsSummary | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch buildings list
  useEffect(() => {
    async function loadBuildings() {
      try {
        const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
        const { data } = await api.get(url);
        setBuildings(data);
        if (data.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(data[0].id);
        }
      } catch (err: unknown) {
        console.error('Failed to load buildings', err);
      }
    }
    loadBuildings();
  }, [activeOrg]);

  // Load KPI data
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeOrg?.id) params.append('organizationId', activeOrg.id);
      if (selectedBuildingId) params.append('buildingId', selectedBuildingId);

      // Parallel fetch collection report, arrears summary, and recent invoices
      const [colRes, arrRes, invRes] = await Promise.allSettled([
        api.get<CollectionReport>(`/reports/collection?${params.toString()}`),
        api.get<ArrearsSummary>(`/payments/arrears-summary${selectedBuildingId ? `?buildingId=${selectedBuildingId}` : ''}`),
        api.get<RecentInvoice[]>(`/billing/invoices?${params.toString()}`),
      ]);

      if (colRes.status === 'fulfilled') {
        setCollection(colRes.value.data);
      }
      if (arrRes.status === 'fulfilled') {
        setArrears(arrRes.value.data);
      }
      if (invRes.status === 'fulfilled') {
        setRecentInvoices(invRes.value.data.slice(0, 5));
      }
    } catch (err: unknown) {
      console.error('Failed to load dashboard metrics', err);
      setError('Unable to load some dashboard metrics. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, selectedBuildingId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const totalBilled = collection?.totalBilled || 0;
  const totalCollected = collection?.totalCollected || 0;
  const totalArrears = arrears?.totalArrears || 0;
  const overdueAmount = arrears?.overdueAmount || collection?.totalOverdue || 0;
  const collectionRate = collection?.collectionRatePercent || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, hsl(239, 84%, 18%), var(--color-surface-1))',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
              background: 'hsl(239, 84%, 28%)',
              color: 'var(--color-brand-100)',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 'var(--space-2)',
            }}
          >
            <ShieldCheck size={14} /> Span Tower Condominium Billing
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '4px',
            }}
          >
            Welcome back, {user?.name || 'Administrator'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Condominium management & automated maintenance billing hub for{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {activeOrg?.name || 'Span Tower IX'}
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {buildings.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-2)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <Building2 size={16} color="var(--color-brand-400)" />
              <select
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id} style={{ background: 'var(--color-surface-2)' }}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadDashboardData}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.75rem' }}
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span style={{ fontSize: '0.85rem' }}>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1rem', background: 'hsla(0, 84%, 60%, 0.1)', border: '1px solid hsla(0, 84%, 60%, 0.3)', borderRadius: 'var(--radius-md)', color: 'hsl(0, 84%, 60%)', fontSize: '0.875rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* 5 Primary Financial KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Total Billed */}
        <div className="card" style={{ borderLeft: '4px solid var(--color-brand-500)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Billed
            </span>
            <div style={{ padding: '6px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <DollarSign size={18} color="var(--color-brand-400)" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Rs. {totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {collection?.invoicesCount ?? 0} invoices generated
          </div>
        </div>

        {/* Total Collected */}
        <div className="card" style={{ borderLeft: '4px solid #10b981', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Collected
            </span>
            <div style={{ padding: '6px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <TrendingUp size={18} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981' }}>
            Rs. {totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {collection?.paidInvoicesCount ?? 0} fully paid invoices
          </div>
        </div>

        {/* Outstanding Arrears */}
        <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Arrears
            </span>
            <div style={{ padding: '6px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <Clock size={18} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: totalArrears > 0 ? '#f59e0b' : 'var(--color-text-primary)' }}>
            Rs. {totalArrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {arrears?.totalApartmentsWithArrears ?? 0} units with arrears
          </div>
        </div>

        {/* Overdue Bills */}
        <div className="card" style={{ borderLeft: '4px solid #ef4444', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Overdue Amount
            </span>
            <div style={{ padding: '6px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: overdueAmount > 0 ? '#ef4444' : 'var(--color-text-primary)' }}>
            Rs. {overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Past payment due date
          </div>
        </div>

        {/* Collection Rate */}
        <div className="card" style={{ borderLeft: '4px solid #8b5cf6', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Collection Rate
            </span>
            <div style={{ padding: '6px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <Percent size={18} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: collectionRate >= 80 ? '#10b981' : collectionRate >= 50 ? '#f59e0b' : 'var(--color-text-primary)' }}>
            {collectionRate.toFixed(1)}%
          </div>
          {/* Mini progress bar */}
          <div style={{ height: '6px', background: 'var(--color-surface-3)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, collectionRate))}%`,
                height: '100%',
                background: collectionRate >= 80 ? '#10b981' : collectionRate >= 50 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions Shortcuts */}
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle size={16} color="var(--color-brand-400)" /> Quick Billing & Management Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          {hasPermission('billing.manage') && (
            <Link
              to="/dashboard/monthly-billing"
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.65rem 1rem', fontSize: '0.85rem' }}
            >
              <FileText size={16} color="var(--color-brand-400)" />
              Bulk Generate Bills
            </Link>
          )}

          {hasPermission('payments.manage') && (
            <Link
              to="/dashboard/payments"
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.65rem 1rem', fontSize: '0.85rem' }}
            >
              <CreditCard size={16} color="#10b981" />
              Record Payment
            </Link>
          )}

          {hasPermission('apartments.read') && (
            <Link
              to="/dashboard/water-readings"
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.65rem 1rem', fontSize: '0.85rem' }}
            >
              <Droplets size={16} color="#06b6d4" />
              Enter Water Readings
            </Link>
          )}

          <Link
            to="/dashboard/arrears"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.65rem 1rem', fontSize: '0.85rem' }}
          >
            <Clock size={16} color="#f59e0b" />
            View Arrears Ageing
          </Link>

          <Link
            to="/dashboard/reports"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.65rem 1rem', fontSize: '0.85rem' }}
          >
            <TrendingUp size={16} color="#8b5cf6" />
            Financial Reports
          </Link>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Recent Apartment Invoices</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
              Latest generated maintenance & water bills
            </p>
          </div>
          <Link
            to="/dashboard/invoices"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--color-brand-400)', fontWeight: 600 }}
          >
            View all invoices <ArrowRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)', gap: '8px' }}>
            <Loader2 size={20} className="spin" color="var(--color-brand-400)" />
            <span style={{ fontSize: '0.875rem' }}>Loading invoices...</span>
          </div>
        ) : recentInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No recent invoices found for this building. Use the{' '}
            <Link to="/dashboard/monthly-billing" style={{ color: 'var(--color-brand-400)' }}>
              Monthly Billing
            </Link>{' '}
            tool to generate invoices.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Unit</th>
                  <th>Resident</th>
                  <th>Period</th>
                  <th>Due Date</th>
                  <th>Total Due (LKR)</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                    <td style={{ fontWeight: 700 }}>Unit {inv.apartment.unitNumber}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {inv.apartment.residentName || inv.apartment.ownerName || '—'}
                    </td>
                    <td>{inv.period?.periodCode || '—'}</td>
                    <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight: 700 }}>
                      Rs. {Number(inv.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontWeight: 600, color: Number(inv.balanceAmount) > 0 ? '#ef4444' : '#10b981' }}>
                      Rs. {Number(inv.balanceAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          inv.status === 'PAID'
                            ? 'badge-success'
                            : inv.status === 'PARTIALLY_PAID'
                            ? 'badge-warning'
                            : inv.status === 'FINALIZED'
                            ? 'badge-primary'
                            : 'badge-secondary'
                        }`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
