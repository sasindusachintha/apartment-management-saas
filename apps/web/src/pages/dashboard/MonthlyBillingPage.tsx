import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Calculator,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  Download,
  RefreshCw,
  X,
} from 'lucide-react';

interface Building {
  id: string;
  name: string;
}

interface BillingPeriod {
  id: string;
  name: string;
  periodCode: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  isClosed: boolean;
  _count?: { invoices: number };
}

interface Apartment {
  id: string;
  unitNumber: string;
  floor: number;
  areaSqft: number;
  ownerName?: string | null;
  residentName?: string | null;
  tower?: { id: string; name: string } | null;
  rooms?: Array<{
    id: string;
    roomNumber: string;
    roomType: string;
    areaSqft: number | string;
    maintenanceRate?: number | string | null;
  }>;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodCode: string;
  dueDate: string;
  status: string;
  apartmentAreaSqft: number | string;
  maintenanceRate: number | string;
  maintenanceAmount: number | string;
  waterAmount: number | string;
  otherChargesAmount: number | string;
  currentChargesTotal: number | string;
  previousArrears: number | string;
  totalDue: number | string;
  paidAmount: number | string;
  balanceDue: number | string;
  apartment: {
    id: string;
    unitNumber: string;
    floor: number;
    ownerName?: string | null;
    residentName?: string | null;
  };
}

export default function MonthlyBillingPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [periods, setPeriods] = useState<BillingPeriod[]>([]);
  const [selectedPeriodCode, setSelectedPeriodCode] = useState<string>('2026-10');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [billingSetting, setBillingSetting] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Single Generate Form
  const [singleForm, setSingleForm] = useState({
    apartmentId: '',
    periodCode: '2026-10',
    includeWater: true,
    additionalDesc: '',
    additionalAmount: 0,
    finalizeImmediately: false,
  });

  // Bulk Generate Form
  const [bulkForm, setBulkForm] = useState({
    periodCode: '2026-10',
    includeWater: true,
    commonChargeDesc: 'Common Utility / Generator Fuel',
    commonChargeAmount: 200,
    finalizeImmediately: false,
  });

  // Create Period Form
  const [periodForm, setPeriodForm] = useState({
    name: 'November 2026',
    periodCode: '2026-11',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    dueDate: '2026-11-25',
  });

  const canManage = hasPermission('billing.manage');

  // Load Buildings
  const fetchBuildings = useCallback(async () => {
    try {
      const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
      const { data } = await api.get(url);
      setBuildings(data);
      if (data.length > 0 && !selectedBuildingId) {
        setSelectedBuildingId(data[0].id);
      }
    } catch {}
  }, [activeOrg, selectedBuildingId]);

  // Load Periods & Settings & Apartments
  const fetchContext = useCallback(async () => {
    if (!selectedBuildingId) return;
    try {
      const [periodsRes, settingsRes, aptsRes] = await Promise.all([
        api.get(`/billing/periods?buildingId=${selectedBuildingId}`),
        api.get(`/billing/settings/${selectedBuildingId}`),
        api.get(`/apartments?buildingId=${selectedBuildingId}`),
      ]);
      setPeriods(periodsRes.data);
      if (periodsRes.data.length > 0 && !selectedPeriodCode) {
        setSelectedPeriodCode(periodsRes.data[0].periodCode);
      }
      setBillingSetting(settingsRes.data);
      setApartments(aptsRes.data);
    } catch {}
  }, [selectedBuildingId, selectedPeriodCode]);

  // Load Invoices for Period
  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/billing/invoices?`;
      if (activeOrg) url += `organizationId=${activeOrg.id}&`;
      if (selectedBuildingId) url += `buildingId=${selectedBuildingId}&`;
      if (selectedPeriodCode) url += `periodCode=${selectedPeriodCode}&`;

      const { data } = await api.get(url);
      setInvoices(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch invoices';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, selectedBuildingId, selectedPeriodCode]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle Create Period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id || !selectedBuildingId) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/billing/periods', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId,
        name: periodForm.name,
        periodCode: periodForm.periodCode,
        startDate: periodForm.startDate,
        endDate: periodForm.endDate,
        dueDate: periodForm.dueDate,
      });
      setShowPeriodModal(false);
      setSelectedPeriodCode(periodForm.periodCode);
      fetchContext();
      setSuccessMsg(`Billing period ${periodForm.name} created.`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create billing period';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Bulk Generation
  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id || !selectedBuildingId) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const commonCharges = [];
      if (bulkForm.commonChargeDesc && Number(bulkForm.commonChargeAmount) > 0) {
        commonCharges.push({
          itemType: 'UTILITY',
          description: bulkForm.commonChargeDesc,
          unitRate: Number(bulkForm.commonChargeAmount),
          amount: Number(bulkForm.commonChargeAmount),
        });
      }

      const { data } = await api.post('/billing/invoices/bulk-generate', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId,
        periodCode: bulkForm.periodCode,
        includeWater: bulkForm.includeWater,
        commonCharges,
        finalize: bulkForm.finalizeImmediately,
      });

      setShowBulkModal(false);
      setSuccessMsg(data.message);
      fetchInvoices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Bulk generation failed';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Single Bill Generation
  const handleSingleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id || !selectedBuildingId) return;
    if (!singleForm.apartmentId) {
      setModalError('Please select an apartment');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const additionalCharges = [];
      if (singleForm.additionalDesc && Number(singleForm.additionalAmount) > 0) {
        additionalCharges.push({
          itemType: 'OTHER',
          description: singleForm.additionalDesc,
          unitRate: Number(singleForm.additionalAmount),
          amount: Number(singleForm.additionalAmount),
        });
      }

      await api.post('/billing/invoices/generate', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId,
        apartmentId: singleForm.apartmentId,
        periodCode: singleForm.periodCode,
        includeWater: singleForm.includeWater,
        additionalCharges,
        finalize: singleForm.finalizeImmediately,
      });

      setShowSingleModal(false);
      setSuccessMsg('Invoice generated successfully.');
      fetchInvoices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invoice generation failed';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Finalize Draft Invoices
  const draftInvoices = invoices.filter((i) => i.status === 'DRAFT');
  const handleFinalizeAll = async () => {
    if (!activeOrg?.id || draftInvoices.length === 0) return;
    setIsSubmitting(true);
    try {
      const ids = draftInvoices.map((i) => i.id);
      await api.post('/billing/invoices/finalize', {
        organizationId: activeOrg.id,
        invoiceIds: ids,
      });
      setShowFinalizeModal(false);
      setSuccessMsg(`Successfully finalized ${ids.length} invoices. They are now officially issued.`);
      fetchInvoices();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to finalize invoices',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Invoice PDF
  const downloadPdf = (invId: string, _invoiceNumber?: string) => {
    window.open(`${api.defaults.baseURL}/billing/invoices/${invId}/pdf`, '_blank');
  };

  // Summary Metrics
  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.totalDue), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);
  const totalBalance = invoices.reduce((sum, i) => sum + Number(i.balanceDue), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--color-text-primary)',
            }}
          >
            Monthly Maintenance Billing
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Automated calculations based on floor area (Sq.Ft.), water meter readings, utilities, and previous arrears.
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                setModalError(null);
                setShowSingleModal(true);
              }}
            >
              <Plus size={16} /> Individual Bill
            </button>
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={() => {
                setModalError(null);
                setShowBulkModal(true);
              }}
            >
              <Calculator size={16} /> Bulk Generate Building Bills
            </button>
          </div>
        )}
      </div>

      {/* Building & Billing Period Selection Ribbon */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', flex: 1 }}>
          {/* Building */}
          <div style={{ minWidth: '220px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              Condominium Building
            </label>
            <select
              className="input"
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Billing Cycle */}
          <div style={{ minWidth: '200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              Billing Period (Cycle)
            </label>
            <select
              className="input"
              value={selectedPeriodCode}
              onChange={(e) => setSelectedPeriodCode(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.periodCode}>
                  {p.name} ({p.periodCode})
                </option>
              ))}
              {!periods.some((p) => p.periodCode === '2026-10') && (
                <option value="2026-10">October 2026 (2026-10)</option>
              )}
            </select>
          </div>

          {/* Current Rate Indicator */}
          {billingSetting && (
            <div style={{ padding: '0 var(--space-2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Configured Rate</span>
              <span style={{ fontWeight: 700, color: 'var(--color-brand-400)', fontSize: '0.95rem' }}>
                Rs. {Number(billingSetting.maintenanceRatePerSqft).toFixed(2)} / sq ft
              </span>
            </div>
          )}
        </div>

        {canManage && (
          <button
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem' }}
            onClick={() => {
              setModalError(null);
              setShowPeriodModal(true);
            }}
          >
            <Calendar size={14} /> New Billing Period
          </button>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'hsl(142, 76%, 12%)',
            border: '1px solid var(--color-success-500)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="var(--color-success-500)" />
            <span>{successMsg}</span>
          </div>
          <button className="btn-ghost" onClick={() => setSuccessMsg(null)}>
            <X size={16} />
          </button>
        </div>
      )}

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

      {/* Stat Cards for Period */}
      <div className="grid grid-4">
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            INVOICES GENERATED
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px' }}>
            {invoices.length}{' '}
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              / {apartments.length} Units
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            TOTAL BILLED (CYCLE)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-brand-400)' }}>
            Rs. {totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            COLLECTED SO FAR
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: 'var(--color-success-500)' }}>
            Rs. {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Balance: Rs. {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            DRAFT BILLS PENDING
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: draftInvoices.length > 0 ? 'var(--color-warning-500)' : 'var(--color-text-primary)' }}>
              {draftInvoices.length}
            </span>
            {draftInvoices.length > 0 && canManage && (
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={() => setShowFinalizeModal(true)}
              >
                Finalize All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Draft Invoices Review Notice */}
      {draftInvoices.length > 0 && (
        <div
          style={{
            background: 'hsl(38, 92%, 12%)',
            border: '1px solid var(--color-warning-500)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} color="var(--color-warning-500)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
              <strong>{draftInvoices.length} draft bills</strong> have been calculated and are awaiting review before official issuance.
            </span>
          </div>
          {canManage && (
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              onClick={() => setShowFinalizeModal(true)}
            >
              Review & Finalize {draftInvoices.length} Bills
            </button>
          )}
        </div>
      )}

      {/* Invoices Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Invoices for {selectedPeriodCode}
          </h3>
          <button className="btn-ghost" onClick={fetchInvoices} title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
            <p>Loading monthly invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Calculator size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>No invoices generated for period {selectedPeriodCode}</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Click <strong>Bulk Generate Building Bills</strong> to calculate maintenance fees for all apartments automatically.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Invoice #</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Apt Unit</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Area (Sq.Ft.)</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Maintenance</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Water</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Arrears B/F</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Total Due</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-brand-400)' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        Unit {inv.apartment.unitNumber}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {inv.apartment.ownerName || '-'}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {Number(inv.apartmentAreaSqft).toLocaleString()} sq ft
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      Rs. {Number(inv.maintenanceAmount).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      Rs. {Number(inv.waterAmount).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: Number(inv.previousArrears) > 0 ? 'var(--color-warning-500)' : 'inherit' }}>
                      Rs. {Number(inv.previousArrears).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800 }}>
                      Rs. {Number(inv.totalDue).toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span
                        className={`badge ${
                          inv.status === 'PAID'
                            ? 'badge-success'
                            : inv.status === 'ISSUED'
                            ? 'badge-primary'
                            : inv.status === 'DRAFT'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      <button
                        className="btn-ghost"
                        title="Download / View Span Tower IX PDF Bill"
                        onClick={() => downloadPdf(inv.id, inv.invoiceNumber)}
                        style={{ padding: '6px' }}
                      >
                        <Download size={15} color="var(--color-brand-400)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── BULK GENERATE MODAL ──────────────────────────────── */}
      {showBulkModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Bulk Generate Monthly Bills
              </h3>
              <button className="btn-ghost" onClick={() => setShowBulkModal(false)}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', background: 'hsl(0, 84%, 12%)', border: '1px solid var(--color-danger-500)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-100)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleBulkGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label">Billing Cycle (Period Code) *</label>
                <input
                  type="text"
                  className="input"
                  value={bulkForm.periodCode}
                  onChange={(e) => setBulkForm({ ...bulkForm, periodCode: e.target.value })}
                  placeholder="YYYY-MM (e.g. 2026-10)"
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="includeWater"
                  checked={bulkForm.includeWater}
                  onChange={(e) => setBulkForm({ ...bulkForm, includeWater: e.target.checked })}
                />
                <label htmlFor="includeWater" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Include water meter consumption charges from recorded readings
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Standard Common Utility / Additional Surcharge (Optional)
                </span>
                <div className="grid grid-2" style={{ gap: 'var(--space-3)', marginTop: '8px' }}>
                  <div>
                    <label className="label">Charge Description</label>
                    <input
                      type="text"
                      className="input"
                      value={bulkForm.commonChargeDesc}
                      onChange={(e) => setBulkForm({ ...bulkForm, commonChargeDesc: e.target.value })}
                      placeholder="e.g. Generator Fuel & Elevator"
                    />
                  </div>
                  <div>
                    <label className="label">Amount (Rs.)</label>
                    <input
                      type="number"
                      className="input"
                      value={bulkForm.commonChargeAmount}
                      onChange={(e) => setBulkForm({ ...bulkForm, commonChargeAmount: Number(e.target.value) })}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="finalizeImm"
                  checked={bulkForm.finalizeImmediately}
                  onChange={(e) => setBulkForm({ ...bulkForm, finalizeImmediately: e.target.checked })}
                />
                <label htmlFor="finalizeImm" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--color-warning-500)', fontWeight: 600 }}>
                  Finalize and officially issue immediately (Skip draft review)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowBulkModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Calculating...' : 'Generate Invoices'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── INDIVIDUAL INVOICE MODAL ────────────────────────── */}
      {showSingleModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Generate Individual Apartment Bill
              </h3>
              <button className="btn-ghost" onClick={() => setShowSingleModal(false)}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', background: 'hsl(0, 84%, 12%)', border: '1px solid var(--color-danger-500)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-100)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSingleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label">Target Apartment *</label>
                <select
                  className="input"
                  value={singleForm.apartmentId}
                  onChange={(e) => setSingleForm({ ...singleForm, apartmentId: e.target.value })}
                  required
                >
                  <option value="">Select Apartment Unit...</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Unit {a.unitNumber} {a.tower ? `(${a.tower.name})` : ''} — {a.areaSqft} sq ft ({a.rooms?.length ? `${a.rooms.length} Rooms` : 'Flat Area'})
                    </option>
                  ))}
                </select>
                {(() => {
                  const selApt = apartments.find((a) => a.id === singleForm.apartmentId);
                  if (!selApt) return null;
                  const hasRooms = selApt.rooms && selApt.rooms.length > 0;
                  return (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '10px 12px',
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: hasRooms ? 'var(--color-brand-400)' : 'var(--color-text-secondary)' }}>
                          {hasRooms ? `✓ Room-Level Calculation Active (${selApt.rooms?.length} Rooms)` : 'Flat Apartment Area Calculation'}
                        </span>
                        <span style={{ fontWeight: 600 }}>{selApt.areaSqft} sq. ft. total</span>
                      </div>
                      {hasRooms && selApt.rooms && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {selApt.rooms.map((rm) => (
                            <span
                              key={rm.id}
                              className="badge badge-outline"
                              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            >
                              {rm.roomNumber}: {Number(rm.areaSqft)} sq ft
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="label">Period Code *</label>
                <input
                  type="text"
                  className="input"
                  value={singleForm.periodCode}
                  onChange={(e) => setSingleForm({ ...singleForm, periodCode: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="singleWater"
                  checked={singleForm.includeWater}
                  onChange={(e) => setSingleForm({ ...singleForm, includeWater: e.target.checked })}
                />
                <label htmlFor="singleWater" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Include water meter reading charge
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Additional Charge (Optional)
                </span>
                <div className="grid grid-2" style={{ gap: 'var(--space-3)', marginTop: '8px' }}>
                  <div>
                    <label className="label">Charge Description</label>
                    <input
                      type="text"
                      className="input"
                      value={singleForm.additionalDesc}
                      onChange={(e) => setSingleForm({ ...singleForm, additionalDesc: e.target.value })}
                      placeholder="e.g. Repairs or Sinking Fund"
                    />
                  </div>
                  <div>
                    <label className="label">Amount (Rs.)</label>
                    <input
                      type="number"
                      className="input"
                      value={singleForm.additionalAmount}
                      onChange={(e) => setSingleForm({ ...singleForm, additionalAmount: Number(e.target.value) })}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowSingleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Calculating...' : 'Generate Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── FINALIZE CONFIRMATION MODAL ─────────────────────── */}
      {showFinalizeModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <CheckCircle2 size={44} color="var(--color-success-500)" style={{ margin: '0 auto var(--space-3)' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Finalize {draftInvoices.length} Invoices?
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Finalizing will transition these draft invoices to <strong>ISSUED</strong> status and lock all calculation lines. Financial adjustments can subsequently be recorded through auditable corrections.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowFinalizeModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleFinalizeAll}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Finalizing...' : 'Yes, Finalize & Issue Bills'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE PERIOD MODAL ─────────────────────────────── */}
      {showPeriodModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Create New Billing Period
              </h3>
              <button className="btn-ghost" onClick={() => setShowPeriodModal(false)}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', background: 'hsl(0, 84%, 12%)', border: '1px solid var(--color-danger-500)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-100)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreatePeriod} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label">Period Name *</label>
                <input
                  type="text"
                  className="input"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  placeholder="e.g. November 2026"
                  required
                />
              </div>

              <div>
                <label className="label">Period Code (YYYY-MM) *</label>
                <input
                  type="text"
                  className="input"
                  value={periodForm.periodCode}
                  onChange={(e) => setPeriodForm({ ...periodForm, periodCode: e.target.value })}
                  placeholder="2026-11"
                  required
                />
              </div>

              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Start Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">End Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Payment Due Date *</label>
                <input
                  type="date"
                  className="input"
                  value={periodForm.dueDate}
                  onChange={(e) => setPeriodForm({ ...periodForm, dueDate: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPeriodModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
