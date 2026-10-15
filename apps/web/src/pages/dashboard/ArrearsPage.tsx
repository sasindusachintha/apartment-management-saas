import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Search,
  Home,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
} from 'lucide-react';

interface ArrearsSummary {
  totalBilled: number;
  totalCollected: number;
  outstandingArrears: number;
  overdueTotal: number;
  overdueCount: number;
  collectionRate: number;
  apartmentsWithArrears: Array<{
    apartmentId: string;
    unitNumber: string;
    buildingName: string;
    ownerName: string | null;
    residentName: string | null;
    balanceDue: number;
    overdueInvoices: number;
  }>;
}

export default function ArrearsPage() {
  const { activeOrg } = useAuth();
  const [summary, setSummary] = useState<ArrearsSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArrears = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = activeOrg
        ? `/payments/arrears-summary?organizationId=${activeOrg.id}`
        : '/payments/arrears-summary';
      const { data } = await api.get(url);
      setSummary(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch arrears summary';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    fetchArrears();
  }, [fetchArrears]);

  const filteredApartments = (summary?.apartmentsWithArrears || []).filter((apt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      apt.unitNumber.toLowerCase().includes(term) ||
      (apt.ownerName && apt.ownerName.toLowerCase().includes(term)) ||
      (apt.residentName && apt.residentName.toLowerCase().includes(term)) ||
      apt.buildingName.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
          }}
        >
          Outstanding Arrears & Dues
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Real-time tracking of unpaid balances, overdue aging, and condominium debt collection.
        </p>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-4">
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              TOTAL OUTSTANDING ARREARS
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: summary.outstandingArrears > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)',
                marginTop: '4px',
              }}
            >
              Rs. {summary.outstandingArrears.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              OVERDUE BALANCE
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-warning-500)', marginTop: '4px' }}>
              Rs. {summary.overdueTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              {summary.overdueCount} overdue bills past due date
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              TOTAL COLLECTED
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success-500)', marginTop: '4px' }}>
              Rs. {summary.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              OVERALL COLLECTION RATE
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand-400)', marginTop: '4px' }}>
              {summary.collectionRate}%
            </div>
            <div
              style={{
                width: '100%',
                background: 'var(--color-surface-3)',
                height: '6px',
                borderRadius: 'var(--radius-full)',
                marginTop: '6px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, summary.collectionRate)}%`,
                  background: 'var(--color-brand-500)',
                  height: '100%',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="card" style={{ padding: 'var(--space-3)' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            color="var(--color-text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="input"
            placeholder="Search apartment unit (e.g. 4B), owner, resident..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', width: '100%' }}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'hsl(0, 84%, 12%)',
            border: '1px solid var(--color-danger-500)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger-100)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={18} color="var(--color-danger-500)" />
          <span>{error}</span>
        </div>
      )}

      {/* Arrears List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Apartments with Outstanding Arrears ({filteredApartments.length})
          </h3>
          <Link to="/dashboard/payments" className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            <CreditCard size={14} /> Record Payment
          </Link>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
            <p>Loading arrears analysis...</p>
          </div>
        ) : filteredApartments.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <CheckCircle2 size={40} color="var(--color-success-500)" style={{ margin: '0 auto var(--space-3)' }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No Outstanding Arrears</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              All apartment maintenance and utility bills have been settled in full.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Apartment Unit</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Building</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Owner / Resident</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Overdue Bills</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Total Arrears Balance</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApartments.map((apt) => (
                  <tr key={apt.apartmentId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Home size={15} color="var(--color-brand-400)" />
                        Unit {apt.unitNumber}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                      {apt.buildingName}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontWeight: 600 }}>{apt.ownerName || 'Unassigned'}</div>
                      {apt.residentName && apt.residentName !== apt.ownerName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          Tenant: {apt.residentName}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      {apt.overdueInvoices > 0 ? (
                        <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                          {apt.overdueInvoices} Overdue
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                          Current Cycle
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800, color: 'var(--color-danger-500)', fontSize: '1.05rem' }}>
                      Rs. {apt.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      <Link
                        to="/dashboard/payments"
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                      >
                        Settle Dues
                      </Link>
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
