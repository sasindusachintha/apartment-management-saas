import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Printer,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function ReportsPage() {
  const { activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<'collection' | 'arrears' | 'statement' | 'payments'>('collection');
  const [buildings, setBuildings] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>('');
  const [periodCode, setPeriodCode] = useState<string>('2026-10');

  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load Buildings
  useEffect(() => {
    const loadBuildings = async () => {
      try {
        const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
        const { data } = await api.get(url);
        setBuildings(data);
        if (data.length > 0) {
          setSelectedBuildingId(data[0].id);
        }
      } catch {}
    };
    loadBuildings();
  }, [activeOrg]);

  // Load Apartments when building changes
  useEffect(() => {
    if (!selectedBuildingId) return;
    const loadApts = async () => {
      try {
        const { data } = await api.get(`/apartments?buildingId=${selectedBuildingId}`);
        setApartments(data);
        if (data.length > 0) {
          setSelectedApartmentId(data[0].id);
        }
      } catch {}
    };
    loadApts();
  }, [selectedBuildingId]);

  // Fetch Report based on Active Tab
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'collection') {
        const { data } = await api.get(
          `/reports/collection?organizationId=${activeOrg?.id || ''}&buildingId=${selectedBuildingId}&periodCode=${periodCode}`,
        );
        setReportData(data);
      } else if (activeTab === 'arrears') {
        const { data } = await api.get(
          `/reports/arrears?organizationId=${activeOrg?.id || ''}&buildingId=${selectedBuildingId}`,
        );
        setReportData(data);
      } else if (activeTab === 'statement') {
        if (!selectedApartmentId) return;
        const { data } = await api.get(`/reports/statement/${selectedApartmentId}`);
        setReportData(data);
      } else if (activeTab === 'payments') {
        const { data } = await api.get(
          `/reports/payments?organizationId=${activeOrg?.id || ''}&buildingId=${selectedBuildingId}`,
        );
        setReportData(data);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to generate report';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, activeOrg, selectedBuildingId, selectedApartmentId, periodCode]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
            }}
          >
            Financial & Operational Reports
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Comprehensive collection summaries, arrears aging, individual apartment statements, and remittance reports (LKR).
          </p>
        </div>

        <button className="btn btn-outline" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Printer size={16} /> Print Report
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '2px', overflowX: 'auto' }}>
        <button
          className={`btn-ghost ${activeTab === 'collection' ? 'btn-ghost--active' : ''}`}
          style={{
            borderBottom: activeTab === 'collection' ? '2px solid var(--color-brand-400)' : 'none',
            borderRadius: 0,
            fontWeight: 700,
            padding: '0.5rem 1rem',
          }}
          onClick={() => setActiveTab('collection')}
        >
          Monthly Collection Report
        </button>

        <button
          className={`btn-ghost ${activeTab === 'arrears' ? 'btn-ghost--active' : ''}`}
          style={{
            borderBottom: activeTab === 'arrears' ? '2px solid var(--color-brand-400)' : 'none',
            borderRadius: 0,
            fontWeight: 700,
            padding: '0.5rem 1rem',
          }}
          onClick={() => setActiveTab('arrears')}
        >
          Outstanding Arrears Report
        </button>

        <button
          className={`btn-ghost ${activeTab === 'statement' ? 'btn-ghost--active' : ''}`}
          style={{
            borderBottom: activeTab === 'statement' ? '2px solid var(--color-brand-400)' : 'none',
            borderRadius: 0,
            fontWeight: 700,
            padding: '0.5rem 1rem',
          }}
          onClick={() => setActiveTab('statement')}
        >
          Apartment Financial Statement / Ledger
        </button>

        <button
          className={`btn-ghost ${activeTab === 'payments' ? 'btn-ghost--active' : ''}`}
          style={{
            borderBottom: activeTab === 'payments' ? '2px solid var(--color-brand-400)' : 'none',
            borderRadius: 0,
            fontWeight: 700,
            padding: '0.5rem 1rem',
          }}
          onClick={() => setActiveTab('payments')}
        >
          Payment Transactions Report
        </button>
      </div>

      {/* Controls Ribbon */}
      <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
        <div style={{ minWidth: '200px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
            Building
          </label>
          <select
            className="input"
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            style={{ width: '100%', padding: '0.45rem' }}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'collection' && (
          <div style={{ minWidth: '160px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
              Period Code
            </label>
            <input
              type="text"
              className="input"
              value={periodCode}
              onChange={(e) => setPeriodCode(e.target.value)}
              placeholder="e.g. 2026-10"
              style={{ width: '100%', padding: '0.45rem' }}
            />
          </div>
        )}

        {activeTab === 'statement' && (
          <div style={{ minWidth: '220px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
              Select Apartment Unit
            </label>
            <select
              className="input"
              value={selectedApartmentId}
              onChange={(e) => setSelectedApartmentId(e.target.value)}
              style={{ width: '100%', padding: '0.45rem' }}
            >
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  Unit {a.unitNumber} ({a.ownerName || 'Unassigned'})
                </option>
              ))}
            </select>
          </div>
        )}

        <button className="btn btn-outline" onClick={fetchReport} style={{ alignSelf: 'flex-end', padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}>
          Refresh Report
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'hsl(0, 84%, 12%)', border: '1px solid var(--color-danger-500)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} color="var(--color-danger-500)" />
          <span>{error}</span>
        </div>
      )}

      {/* Report Content */}
      {isLoading ? (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
          <p>Compiling report data...</p>
        </div>
      ) : !reportData ? null : (
        <>
          {/* ─── TAB 1: COLLECTION REPORT ──────────────────────── */}
          {activeTab === 'collection' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div className="grid grid-3">
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TOTAL BILLED (LKR)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-brand-400)' }}>
                    Rs. {Number(reportData.totalBilled).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {reportData.invoiceCount} Invoices
                  </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TOTAL COLLECTED (LKR)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-success-500)' }}>
                    Rs. {Number(reportData.totalCollected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {reportData.paymentCount} Payments
                  </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>COLLECTION EFFICIENCY</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-text-primary)' }}>
                    {reportData.collectionRate}%
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Recovery vs Total Billed
                  </div>
                </div>
              </div>

              {/* Breakdown Cards */}
              <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>Billed Charges Breakdown</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Maintenance Fees</span>
                      <span style={{ fontWeight: 700 }}>Rs. {Number(reportData.breakdown?.maintenance).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Water Consumption</span>
                      <span style={{ fontWeight: 700 }}>Rs. {Number(reportData.breakdown?.water).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Other Utilities / Generator</span>
                      <span style={{ fontWeight: 700 }}>Rs. {Number(reportData.breakdown?.other).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>Collections by Payment Channel</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bank Transfer (Remittance)</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-success-500)' }}>
                        Rs. {Number(reportData.paymentMethods?.BANK_TRANSFER || 0).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cash</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-success-500)' }}>
                        Rs. {Number(reportData.paymentMethods?.CASH || 0).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cheque</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-success-500)' }}>
                        Rs. {Number(reportData.paymentMethods?.CHEQUE || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 2: ARREARS REPORT ─────────────────────────── */}
          {activeTab === 'arrears' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                  Condominium Arrears Ledger ({reportData.apartmentsCount} Units)
                </h3>
                <span style={{ fontWeight: 800, color: 'var(--color-danger-500)' }}>
                  Total: Rs. {Number(reportData.totalArrearsAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Unit No</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Owner / Resident</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Contact Phone</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Oldest Overdue Bill</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Total Arrears (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.records?.map((r: any) => (
                      <tr key={r.apartmentId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700 }}>
                          Unit {r.unitNumber}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <div style={{ fontWeight: 600 }}>{r.ownerName || 'Unassigned'}</div>
                          {r.residentName && r.residentName !== r.ownerName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                              Tenant: {r.residentName}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                          {r.ownerPhone || '-'}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                          {r.maxDaysOverdue > 0 ? (
                            <span style={{ color: 'var(--color-danger-500)', fontWeight: 600 }}>
                              {r.maxDaysOverdue} days overdue
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-warning-500)' }}>Current Period</span>
                          )}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800, color: 'var(--color-danger-500)' }}>
                          Rs. {Number(r.totalArrears).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 3: APARTMENT STATEMENT / LEDGER ───────────── */}
          {activeTab === 'statement' && reportData.apartment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--color-surface-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                      Apartment Statement: Unit {reportData.apartment.unitNumber}
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      {reportData.apartment.buildingName} · Owner: {reportData.apartment.ownerName} · {reportData.apartment.areaSqft} sq ft
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Current Running Balance</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: reportData.currentOutstandingBalance > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)' }}>
                      Rs. {Number(reportData.currentOutstandingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Date</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Type</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Reference</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Description</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Debit (Billed)</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Credit (Paid)</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.ledger?.map((row: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                          {new Date(row.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span
                            className={`badge ${
                              row.type === 'PAYMENT'
                                ? 'badge-success'
                                : row.type === 'INVOICE'
                                ? 'badge-primary'
                                : 'badge-warning'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>
                          {row.reference}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                          {row.description}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600 }}>
                          {row.debit > 0 ? `Rs. ${Number(row.debit).toFixed(2)}` : '-'}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: 'var(--color-success-500)', fontWeight: 600 }}>
                          {row.credit > 0 ? `Rs. ${Number(row.credit).toFixed(2)}` : '-'}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800 }}>
                          Rs. {Number(row.balance).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 4: PAYMENTS REPORT ────────────────────────── */}
          {activeTab === 'payments' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                  Payment Remittance Audit Log ({reportData.count} Transactions)
                </h3>
                <span style={{ fontWeight: 800, color: 'var(--color-success-500)' }}>
                  Total Collected: Rs. {Number(reportData.totalCollected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Receipt #</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Date</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Unit</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Method</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Reference</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Handled By</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Amount (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.payments?.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-brand-400)' }}>
                          {p.receiptNumber}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>
                          Unit {p.apartment?.unitNumber}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                            {p.paymentMethod.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                          {p.paymentReference}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          {p.recordedByUser?.name || 'Staff'}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800, color: 'var(--color-success-500)' }}>
                          Rs. {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
