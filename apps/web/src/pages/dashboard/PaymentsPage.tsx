import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCard,
  Plus,
  Search,
  Download,
  Eye,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
  Building,
} from 'lucide-react';

interface Payment {
  id: string;
  receiptNumber: string;
  amount: number | string;
  paymentMethod: string;
  paymentReference: string;
  paymentDate: string;
  status: string;
  isOnline: boolean;
  gatewayStatus?: string | null;
  notes?: string | null;
  apartment: {
    id: string;
    unitNumber: string;
    floor: number;
    ownerName?: string | null;
    residentName?: string | null;
  };
  building: {
    id: string;
    name: string;
  };
  recordedByUser?: {
    name: string;
  };
  allocations: Array<{
    id: string;
    amount: number | string;
    invoice: {
      id: string;
      invoiceNumber: string;
      periodCode: string;
      totalDue: number | string;
      balanceDue: number | string;
    };
  }>;
}

interface Apartment {
  id: string;
  unitNumber: string;
  floor: number;
  ownerName?: string | null;
  residentName?: string | null;
  outstandingArrears?: number | string;
}

interface Building {
  id: string;
  name: string;
}

export default function PaymentsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    apartmentId: '',
    amount: 2000,
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
    isOnline: false,
  });

  const canManage = hasPermission('payments.manage');

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

  // Load Payments & Apartments
  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/payments?`;
      if (activeOrg) url += `organizationId=${activeOrg.id}&`;
      if (selectedBuildingId) url += `buildingId=${selectedBuildingId}&`;
      if (methodFilter) url += `paymentMethod=${methodFilter}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;

      const [payRes, aptRes] = await Promise.all([
        api.get(url),
        selectedBuildingId ? api.get(`/apartments?buildingId=${selectedBuildingId}`) : Promise.resolve({ data: [] }),
      ]);

      setPayments(payRes.data);
      setApartments(aptRes.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch payments';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, selectedBuildingId, methodFilter, searchTerm]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Handle Record Payment
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id || !selectedBuildingId || !form.apartmentId) return;
    if (form.amount <= 0 || !form.paymentReference.trim()) {
      setModalError('Please specify valid payment amount and unique reference');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const { data } = await api.post('/payments', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId,
        apartmentId: form.apartmentId,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        paymentReference: form.paymentReference.trim(),
        paymentDate: form.paymentDate,
        notes: form.notes || undefined,
        isOnline: form.paymentMethod === 'ONLINE',
      });

      setShowRecordModal(false);
      setSuccessMsg(`Payment recorded successfully! Receipt: ${data.receiptNumber}`);
      fetchPayments();
      // Open receipt automatically
      setSelectedPayment(data);
      setShowReceiptModal(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to record payment';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download PDF Receipt with Bearer token authentication
  const downloadReceipt = async (paymentId: string) => {
    try {
      const res = await api.get(`/payments/${paymentId}/receipt`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${paymentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download receipt PDF', err);
      alert('Failed to download receipt PDF');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
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
            Payments & Official Receipts
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Record cash, bank transfer, and cheque remittances with automated FIFO allocation to outstanding bills.
          </p>
        </div>

        {canManage && (
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => {
              setModalError(null);
              setForm({
                apartmentId: '',
                amount: 2000,
                paymentMethod: 'BANK_TRANSFER',
                paymentReference: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
                paymentDate: new Date().toISOString().split('T')[0],
                notes: '',
                isOnline: false,
              });
              setShowRecordModal(true);
            }}
          >
            <Plus size={16} /> Record Payment
          </button>
        )}
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
        <div style={{ minWidth: '200px' }}>
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

        <div style={{ minWidth: '160px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Payment Method
          </label>
          <select
            className="input"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="ONLINE">Online Payment</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '240px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Search Receipt # or Reference
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
              placeholder="Search by Receipt #, Reference (TXN...), Unit (4B)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>
        </div>
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

      {/* Payments History Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Remittance Ledger & Receipts
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Showing {payments.length} transactions
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
            <p>Loading payment records...</p>
          </div>
        ) : payments.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <CreditCard size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>No payments found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Click <strong>Record Payment</strong> to register a resident payment and allocate it to outstanding bills.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Receipt Number</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Unit & Payer</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Method & Reference</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Amount Received</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Recorded By</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-brand-400)' }}>
                      {p.receiptNumber}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontWeight: 700 }}>Unit {p.apartment.unitNumber}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {p.apartment.residentName || p.apartment.ownerName || '-'}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                        {p.paymentMethod.replace('_', ' ')}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        Ref: {p.paymentReference}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800, color: 'var(--color-success-500)' }}>
                      Rs. {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {p.status === 'COMPLETED' ? (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          COMPLETED
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }} title={p.gatewayStatus || 'Pending verification'}>
                          PENDING VERIFICATION
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {p.recordedByUser?.name || 'Staff'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          className="btn-ghost"
                          title="View Receipt Details"
                          onClick={() => {
                            setSelectedPayment(p);
                            setShowReceiptModal(true);
                          }}
                          style={{ padding: '6px' }}
                        >
                          <Eye size={15} color="var(--color-brand-400)" />
                        </button>
                        <button
                          className="btn-ghost"
                          title="Download PDF Receipt"
                          onClick={() => downloadReceipt(p.id)}
                          style={{ padding: '6px' }}
                        >
                          <Download size={15} color="var(--color-text-secondary)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── RECORD PAYMENT MODAL ────────────────────────────── */}
      {showRecordModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Record Payment Remittance
              </h3>
              <button className="btn-ghost" onClick={() => setShowRecordModal(false)}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', background: 'hsl(0, 84%, 12%)', border: '1px solid var(--color-danger-500)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-100)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label">Apartment Unit *</label>
                <select
                  className="input"
                  value={form.apartmentId}
                  onChange={(e) => {
                    const apt = apartments.find((a) => a.id === e.target.value);
                    setForm({
                      ...form,
                      apartmentId: e.target.value,
                      amount: apt?.outstandingArrears ? Number(apt.outstandingArrears) : form.amount,
                    });
                  }}
                  required
                >
                  <option value="">Select Apartment Unit...</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Unit {a.unitNumber} - {a.ownerName || 'Unassigned'} (Arrears: Rs. {Number(a.outstandingArrears ?? 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Payment Amount (Rs.) *</label>
                  <input
                    type="number"
                    className="input"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    min={1}
                    required
                  />
                </div>

                <div>
                  <label className="label">Payment Method *</label>
                  <select
                    className="input"
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (Deposit / EFT)</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="ONLINE">Online Payment (Gateway)</option>
                  </select>
                </div>
              </div>

              {form.paymentMethod === 'ONLINE' && (
                <div style={{ background: 'hsl(38, 92%, 12%)', border: '1px solid var(--color-warning-500)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: '0.8rem', color: 'var(--color-warning-100)' }}>
                  <strong>Online Gateway Integration:</strong> Provider credentials pending verification. This payment will be created with status <code>PENDING</code> until gateway webhook confirmation is received.
                </div>
              )}

              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Payment Reference / Cheque No *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. TXN-100234, CHQ-5501"
                    value={form.paymentReference}
                    onChange={(e) => setForm({ ...form, paymentReference: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    Must be unique to prevent duplicate entries
                  </span>
                </div>

                <div>
                  <label className="label">Remittance Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes / Remarks</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Paid via Commercial Bank online transfer"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                <strong>FIFO Allocation:</strong> This payment will automatically be allocated to the oldest outstanding monthly invoices for this apartment, updating their balance due in real time.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowRecordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Record Payment & Allocate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── RECEIPT MODAL ───────────────────────────────────── */}
      {showReceiptModal && selectedPayment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <span className="badge badge-success" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>
                  {selectedPayment.status}
                </span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                  Official Receipt {selectedPayment.receiptNumber}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {selectedPayment.building?.name} · Unit {selectedPayment.apartment?.unitNumber}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => downloadReceipt(selectedPayment.id)}
                >
                  <Download size={14} /> PDF
                </button>
                <button className="btn-ghost" onClick={() => setShowReceiptModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Receipt Summary Card */}
            <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Amount Received</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success-500)' }}>
                    Rs. {Number(selectedPayment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Payment Date</div>
                  <div style={{ fontWeight: 600 }}>{new Date(selectedPayment.paymentDate).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="grid grid-2" style={{ gap: 'var(--space-2)', fontSize: '0.85rem', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Payer / Resident: </span>
                  <span style={{ fontWeight: 600 }}>{selectedPayment.apartment?.residentName || selectedPayment.apartment?.ownerName || '-'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Payment Method: </span>
                  <span style={{ fontWeight: 600 }}>{selectedPayment.paymentMethod.replace('_', ' ')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Reference: </span>
                  <span style={{ fontWeight: 600 }}>{selectedPayment.paymentReference}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Handled By: </span>
                  <span style={{ fontWeight: 600 }}>{selectedPayment.recordedByUser?.name || 'Staff'}</span>
                </div>
              </div>
            </div>

            {/* Invoice Allocation List */}
            {selectedPayment.allocations && selectedPayment.allocations.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                  Allocations to Outstanding Invoices
                </h4>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--color-surface-2)' }}>
                      <tr>
                        <th style={{ padding: '6px 12px' }}>Invoice No</th>
                        <th style={{ padding: '6px 12px' }}>Period</th>
                        <th style={{ padding: '6px 12px', textAlign: 'right' }}>Allocated</th>
                        <th style={{ padding: '6px 12px', textAlign: 'right' }}>Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPayment.allocations.map((a) => (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>{a.invoice.invoiceNumber}</td>
                          <td style={{ padding: '6px 12px' }}>{a.invoice.periodCode}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-success-500)' }}>
                            Rs. {Number(a.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700 }}>
                            Rs. {Number(a.invoice.balanceDue).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowReceiptModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
