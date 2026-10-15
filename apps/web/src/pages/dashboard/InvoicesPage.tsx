import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Search,
  Download,
  Eye,
  Sliders,
  AlertCircle,
  Loader2,
  X,
  Printer,
} from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodCode: string;
  issueDate: string;
  dueDate: string;
  status: string;
  apartmentAreaSqft: number | string;
  maintenanceRate: number | string;
  maintenanceAmount: number | string;
  waterAmount: number | string;
  otherChargesAmount: number | string;
  penaltyAmount: number | string;
  discountAmount: number | string;
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
    areaSqft: number | string;
    tower?: { id: string; name: string } | null;
  };
  building: {
    id: string;
    name: string;
  };
  billingPeriod?: {
    id: string;
    name: string;
    periodCode: string;
  };
  items?: Array<{
    id: string;
    itemType: string;
    description: string;
    quantity: number | string;
    unitRate: number | string;
    amount: number | string;
    roomId?: string | null;
    roomName?: string | null;
    roomType?: string | null;
  }>;
}

export default function InvoicesPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Adjustment Form State
  const [adjustForm, setAdjustForm] = useState({
    adjustmentType: 'CREDIT',
    amount: 0,
    reason: '',
  });

  const canManage = hasPermission('billing.manage');
  const printRef = useRef<HTMLDivElement>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/billing/invoices?`;
      if (activeOrg) url += `organizationId=${activeOrg.id}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (periodFilter) url += `periodCode=${periodFilter}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;

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
  }, [activeOrg, statusFilter, periodFilter, searchTerm]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // View Detailed Invoice
  const handleView = async (inv: Invoice) => {
    try {
      const { data } = await api.get(`/billing/invoices/${inv.id}`);
      setSelectedInvoice(data);
      setShowViewModal(true);
    } catch {
      setSelectedInvoice(inv);
      setShowViewModal(true);
    }
  };

  // Open Adjustment Modal
  const openAdjustModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setAdjustForm({
      adjustmentType: 'CREDIT',
      amount: 0,
      reason: '',
    });
    setModalError(null);
    setShowAdjustModal(true);
  };

  // Submit Auditable Adjustment
  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !activeOrg?.id) return;
    if (adjustForm.amount <= 0 || !adjustForm.reason.trim()) {
      setModalError('Please enter positive adjustment amount and audit reason');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post(`/billing/invoices/${selectedInvoice.id}/adjustments`, {
        organizationId: activeOrg.id,
        adjustmentType: adjustForm.adjustmentType,
        amount: Number(adjustForm.amount),
        reason: adjustForm.reason.trim(),
      });

      setShowAdjustModal(false);
      fetchInvoices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to apply adjustment';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Invoice PDF with Bearer token authentication
  const downloadPdf = async (invId: string) => {
    try {
      const res = await api.get(`/billing/invoices/${invId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download invoice PDF', err);
      alert('Failed to download invoice PDF');
    }
  };

  // Print Invoice (Browser Print Dialog)
  const handlePrint = () => {
    window.print();
  };

  // Filter room maintenance items for display
  const roomItems = selectedInvoice?.items?.filter(
    (it: any) => it.itemType === 'ROOM_MAINTENANCE',
  ) || [];

  const otherChargeItems = selectedInvoice?.items?.filter(
    (it: any) => it.itemType !== 'MAINTENANCE' && it.itemType !== 'ROOM_MAINTENANCE' && it.itemType !== 'WATER',
  ) || [];

  const buildingSettings = selectedInvoice?.building?.billingSettings?.[0] || {};
  const bankName = buildingSettings.bankName || 'Sampath Bank PLC';
  const branchName = buildingSettings.bankBranch || 'Wellawatta Branch';
  const accountName = buildingSettings.bankAccountName || 'Span Tower IX Management Corporation';
  const accountNumber = buildingSettings.bankAccountNumber || '003660000312';
  const contactEmail = buildingSettings.contactEmail || 'span.ebenezer@gmail.com';
  const contactPhone = buildingSettings.contactPhone || '+94 770201034';
  const contactPerson = buildingSettings.contactPerson || 'Mr. Tony David';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ─── PRINT-ONLY CSS ──────────────────────────────────── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #span-tower-bill-print, #span-tower-bill-print * {
            visibility: visible;
          }
          #span-tower-bill-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
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
            Apartment Invoices & Bills
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Official Span Tower IX condominium maintenance fees, room breakdowns, water bills, and payment records.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignItems: 'center',
        }}
      >
        <div style={{ minWidth: '160px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Status
          </label>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Fully Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="VOID">Voided</option>
          </select>
        </div>

        <div style={{ minWidth: '160px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Period Code
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 2026-10"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ flex: 2, minWidth: '240px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Search Unit or Occupant
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--color-text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search Invoice #, Unit (e.g. 6/3, A-101)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: 'var(--space-4)',
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

      {/* Invoices Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
            <p>Loading invoices and billing statements...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <FileText size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>No invoices found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Generate monthly bills from the Monthly Billing page to view them here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Invoice #</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Apartment Unit</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Period</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Due Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Total Bill</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Balance Due</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const bal = Number(inv.balanceDue);
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={14} color="var(--color-brand-400)" />
                          <span>{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          Unit {inv.apartment.unitNumber} {inv.apartment.tower ? `(${inv.apartment.tower.name})` : ''}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          {inv.apartment.ownerName || '-'}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                        {inv.periodCode}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700 }}>
                        Rs. {Number(inv.totalDue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: 'var(--color-success-500)', fontWeight: 600 }}>
                        Rs. {Number(inv.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800 }}>
                        {bal > 0 ? (
                          <span style={{ color: 'var(--color-danger-500)' }}>
                            Rs. {bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-success-500)' }}>Rs. 0.00</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span
                          className={`badge ${
                            inv.status === 'PAID'
                              ? 'badge-success'
                              : inv.status === 'ISSUED'
                              ? 'badge-primary'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'badge-warning'
                              : inv.status === 'OVERDUE'
                              ? 'badge-danger'
                              : 'badge-outline'
                          }`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn-ghost"
                            title="View Span Tower IX Bill Breakdown"
                            onClick={() => handleView(inv)}
                            style={{ padding: '6px' }}
                          >
                            <Eye size={15} color="var(--color-brand-400)" />
                          </button>
                          <button
                            className="btn-ghost"
                            title="Download Official PDF Bill"
                            onClick={() => downloadPdf(inv.id)}
                            style={{ padding: '6px' }}
                          >
                            <Download size={15} color="var(--color-text-secondary)" />
                          </button>
                          {canManage && inv.status !== 'DRAFT' && inv.status !== 'VOID' && (
                            <button
                              className="btn-ghost"
                              title="Auditable Financial Adjustment"
                              onClick={() => openAdjustModal(inv)}
                              style={{ padding: '6px' }}
                            >
                              <Sliders size={15} color="var(--color-accent-400)" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── OFFICIAL SPAN TOWER IX BILL VIEW & PRINT MODAL ───── */}
      {showViewModal && selectedInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto' }}>
            {/* Modal Actions Header */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>
                  {selectedInvoice.status}
                </span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                  Bill Statement #{selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={handlePrint}
                >
                  <Printer size={14} /> Print Bill
                </button>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => downloadPdf(selectedInvoice.id)}
                >
                  <Download size={14} /> Download PDF
                </button>
                <button className="btn-ghost" onClick={() => setShowViewModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ─── AUTHENTIC SPAN TOWER IX BILL SHEET ───────────── */}
            <div
              id="span-tower-bill-print"
              ref={printRef}
              style={{
                background: '#ffffff',
                color: '#111827',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '2px solid #374151',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {/* Outer Bordered Grid Box Matching User's Image */}
              <div style={{ border: '2px solid #111827' }}>
                {/* Header */}
                <div
                  style={{
                    borderBottom: '2px solid #111827',
                    padding: '10px 14px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    background: '#f9fafb',
                  }}
                >
                  SPAN TOWER IX MANAGEMENT CORPORATION -MAINTENANCE FEE & WATER BILL
                </div>

                {/* Row: Apartment No */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #111827' }}>
                    Apartment No
                  </div>
                  <div style={{ width: '60%', padding: '8px 12px', fontWeight: 700 }}>
                    {selectedInvoice.apartment?.unitNumber}
                    {selectedInvoice.apartment?.tower ? ` (${selectedInvoice.apartment.tower.name})` : ''}
                    {selectedInvoice.apartment?.floor ? ` / Floor ${selectedInvoice.apartment.floor}` : ''}
                  </div>
                </div>

                {/* Row: Month */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #111827' }}>
                    Month
                  </div>
                  <div style={{ width: '60%', padding: '8px 12px' }}>
                    {selectedInvoice.billingPeriod?.name || selectedInvoice.periodCode}
                  </div>
                </div>

                {/* Row: Previous Dues */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #111827' }}>
                    Previous Dues
                  </div>
                  <div style={{ width: '60%', padding: '8px 12px', fontWeight: 600 }}>
                    {Number(selectedInvoice.previousArrears) > 0
                      ? `${Number(selectedInvoice.previousArrears).toFixed(2).replace('.', '/')}`
                      : '0/00'}
                  </div>
                </div>

                {/* Row: Maintenance Fee (with itemized room table if rooms exist) */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '8px 12px', fontWeight: 700, borderRight: '1px solid #111827' }}>
                    Maintenance Fee
                  </div>
                  <div style={{ width: '60%', padding: '8px 12px', fontWeight: 700 }}>
                    <span
                      style={{
                        border: '1.5px solid #111827',
                        borderRadius: '16px',
                        padding: '2px 10px',
                        display: 'inline-block',
                      }}
                    >
                      {Number(selectedInvoice.maintenanceAmount).toFixed(0)}/=
                    </span>
                  </div>
                </div>

                {/* ── Itemized Individual Room Breakdown (Prompt Specification 2 & 3) ── */}
                {roomItems.length > 0 && (
                  <div style={{ borderBottom: '1px solid #111827', background: '#f9fafb', padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px', color: '#374151' }}>
                      Detailed Individual Room Schedule (Maintenance Rate × Area)
                    </div>
                    <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #9ca3af', fontWeight: 700 }}>
                          <th style={{ padding: '4px 6px' }}>Room</th>
                          <th style={{ padding: '4px 6px' }}>Type</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right' }}>Area (Sq.Ft.)</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right' }}>Rate / Sq.Ft.</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right' }}>Monthly Charge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomItems.map((r: any) => (
                          <tr key={r.id} style={{ borderBottom: '1px dashed #d1d5db' }}>
                            <td style={{ padding: '4px 6px', fontWeight: 600 }}>{r.roomName || r.description}</td>
                            <td style={{ padding: '4px 6px' }}>{r.roomType ? r.roomType.replace('_', ' ') : 'Room'}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{Number(r.quantity)} sq. ft.</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>Rs. {Number(r.unitRate).toFixed(2)}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>
                              Rs. {Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 800, borderTop: '1px solid #111827' }}>
                          <td colSpan={2} style={{ padding: '6px' }}>
                            Total ({selectedInvoice.apartmentAreaSqft} sq. ft.)
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>
                            {selectedInvoice.apartmentAreaSqft} sq. ft.
                          </td>
                          <td></td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>
                            Rs. {Number(selectedInvoice.maintenanceAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Other Additional Charges (Electricity, Parking, etc.) ── */}
                {otherChargeItems.length > 0 && (
                  <div style={{ borderBottom: '1px solid #111827', background: '#fdfdfd', padding: '8px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px', color: '#4b5563' }}>
                      Additional Charges (Utilities / Common Services)
                    </div>
                    {otherChargeItems.map((it: any) => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '2px 0' }}>
                        <span>{it.description}</span>
                        <span style={{ fontWeight: 600 }}>Rs. {Number(it.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sub-Header: Water Bill Details */}
                <div
                  style={{
                    borderBottom: '1px solid #111827',
                    padding: '6px 12px',
                    fontWeight: 700,
                    fontSize: '12px',
                    background: '#f3f4f6',
                  }}
                >
                  Water Bill Details
                </div>

                {/* Row: Present Meter Reading */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Present Meter Reading
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px' }}>
                    {selectedInvoice.waterReading?.currentReading ?? '-'}
                  </div>
                </div>

                {/* Row: Previous Meter Reading */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Previous Meter Reading
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px' }}>
                    {selectedInvoice.waterReading?.previousReading ?? '-'}
                  </div>
                </div>

                {/* Row: Units for the Month */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Units for the Month
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px' }}>
                    {selectedInvoice.waterReading?.consumption ?? (Number(selectedInvoice.waterAmount) > 0 ? 'Metered' : '0')}
                  </div>
                </div>

                {/* Row: Water bill for last month */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Water bill for last month
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px', fontWeight: 600 }}>
                    {Number(selectedInvoice.waterAmount) > 0 ? `${Number(selectedInvoice.waterAmount).toFixed(0)}/=` : '0/='}
                  </div>
                </div>

                {/* Row: Total Dues to be Paid */}
                <div style={{ display: 'flex', borderBottom: '2px solid #111827', background: '#f9fafb' }}>
                  <div style={{ width: '40%', padding: '10px 12px', fontWeight: 800, fontSize: '13px', borderRight: '1px solid #111827' }}>
                    Total Dues to be Paid
                  </div>
                  <div style={{ width: '60%', padding: '10px 12px', fontWeight: 800, fontSize: '13px' }}>
                    {Number(selectedInvoice.totalDue).toFixed(2).replace('.', '/')}
                  </div>
                </div>

                {/* Sub-Header: Bank Account Details */}
                <div
                  style={{
                    borderBottom: '1px solid #111827',
                    padding: '6px 12px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    background: '#f3f4f6',
                  }}
                >
                  Bank Account Details
                </div>

                {/* Row: Account Name */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Account Name
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px', fontWeight: 600 }}>
                    {accountName}
                  </div>
                </div>

                {/* Row: Account Number */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Account Number
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    {accountNumber}
                  </div>
                </div>

                {/* Row: Bank */}
                <div style={{ display: 'flex', borderBottom: '1px solid #111827' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Bank
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px' }}>
                    {bankName}
                  </div>
                </div>

                {/* Row: Branch */}
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '40%', padding: '6px 12px', borderRight: '1px solid #111827' }}>
                    Branch
                  </div>
                  <div style={{ width: '60%', padding: '6px 12px' }}>
                    {branchName}
                  </div>
                </div>
              </div>

              {/* ── Remittance & SGM Resolution Legal Notice (Exact Photo Wording) ── */}
              <div style={{ marginTop: '16px', fontSize: '11.5px', lineHeight: 1.5, color: '#1f2937' }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  Kindly settle the total dues before the end of the month to the mentioned bank account. Please ensure that you include your <strong>apartment number</strong> as the payment narration.
                </p>

                <p style={{ margin: '0 0 10px 0' }}>
                  Please note that as per a decision taken at the SGM held on 2nd November 2025, a <strong>15% Monthly Penalty</strong> will be imposed on the outstanding dues of the maintenance fees and water bills. The penalty amount will be calculated on a pro rata basis for the period that the dues are outstanding, and will be added to the following month's maintenance fee and water bill for settlement.
                </p>

                <p style={{ margin: '0 0 10px 0' }}>
                  <strong><u>Example:</u></strong><br />
                  If the outstanding amount due is Rs 20,000/-, the monthly penalty of 15% will be Rs 3000/- . If the amount is settled in 10 days, the penalty payable will be 3000/30 x 10 = Rs 1000/-.
                </p>

                <p style={{ margin: '0 0 10px 0' }}>
                  The above decision will be implemented with effect from <strong>1st December 2025</strong>.
                </p>

                <p style={{ margin: '0 0 10px 0' }}>
                  After completing the payment, send the payment slip to <strong>{contactEmail}</strong> or WhatsApp it to <strong>{contactPerson} ({contactPhone})</strong>
                </p>

                <p style={{ margin: '12px 0 0 0', fontWeight: 700 }}>
                  Thank you for your cooperation.
                </p>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button className="btn btn-outline" onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── AUDITABLE ADJUSTMENT MODAL ──────────────────────── */}
      {showAdjustModal && selectedInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  Auditable Adjustment
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  Invoice #{selectedInvoice.invoiceNumber} · Unit {selectedInvoice.apartment?.unitNumber}
                </span>
              </div>
              <button className="btn-ghost" onClick={() => setShowAdjustModal(false)}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  background: 'hsl(0, 84%, 12%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-danger-100)',
                  marginBottom: 'var(--space-3)',
                  fontSize: '0.85rem',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label">Adjustment Type *</label>
                <select
                  className="input"
                  value={adjustForm.adjustmentType}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value })}
                >
                  <option value="CREDIT">Credit (Reduce bill amount / approved discount)</option>
                  <option value="DEBIT">Debit (Add correction / additional charge)</option>
                  <option value="WAIVER">Waiver (Waive penalty or overdue fee)</option>
                </select>
              </div>

              <div>
                <label className="label">Amount (Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount: Number(e.target.value) })}
                  min={0.01}
                  required
                />
              </div>

              <div>
                <label className="label">Audit Justification & Reason *</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="State the financial justification (e.g., Committee approved waiver of penalty, leak rebate)..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Posting...' : 'Post Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
