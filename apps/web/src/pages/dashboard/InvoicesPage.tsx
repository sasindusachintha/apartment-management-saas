import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import OfficialBillView from '../../components/OfficialBillView';

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filters synchronized with URL
  const urlSearch = searchParams.get('search') || '';
  const urlStatus = searchParams.get('status') || '';
  const urlPeriod = searchParams.get('periodCode') || '';
  const urlApartment = searchParams.get('apartmentId') || '';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [periodFilter, setPeriodFilter] = useState(urlPeriod);
  const [apartmentFilter, setApartmentFilter] = useState(urlApartment);
  const [customerFilter, setCustomerFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'apartment' | 'period'>('none');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Keep searchTerm synchronized with URL query parameter changes
  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q !== searchTerm) {
      setSearchTerm(q);
    }
    const st = searchParams.get('status') || '';
    if (st !== statusFilter) {
      setStatusFilter(st);
    }
    const pc = searchParams.get('periodCode') || '';
    if (pc !== periodFilter) {
      setPeriodFilter(pc);
    }
    const ap = searchParams.get('apartmentId') || '';
    if (ap !== apartmentFilter) {
      setApartmentFilter(ap);
    }
  }, [searchParams]);

  // Fetch Invoices from Backend
  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeOrg) params.append('organizationId', activeOrg.id);
      if (statusFilter) params.append('status', statusFilter);
      if (periodFilter) params.append('periodCode', periodFilter);
      if (apartmentFilter) params.append('apartmentId', apartmentFilter);
      if (searchTerm) params.append('search', searchTerm.trim());

      const { data } = await api.get(`/billing/invoices?${params.toString()}`);
      setInvoices(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch invoices';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, statusFilter, periodFilter, apartmentFilter, searchTerm]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle Search Input Change & URL Sync
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    const next = new URLSearchParams(searchParams);
    if (val.trim()) {
      next.set('search', val);
    } else {
      next.delete('search');
    }
    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  };

  // Clear Search button (x)
  const handleClearSearch = () => {
    setSearchTerm('');
    const next = new URLSearchParams(searchParams);
    next.delete('search');
    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  };

  // Status Filter change
  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    const next = new URLSearchParams(searchParams);
    if (val) next.set('status', val);
    else next.delete('status');
    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  };

  // Period Filter change
  const handlePeriodChange = (val: string) => {
    setPeriodFilter(val);
    const next = new URLSearchParams(searchParams);
    if (val) next.set('periodCode', val);
    else next.delete('periodCode');
    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  };

  // Apartment Filter change
  const handleApartmentChange = (val: string) => {
    setApartmentFilter(val);
    const next = new URLSearchParams(searchParams);
    if (val) next.set('apartmentId', val);
    else next.delete('apartmentId');
    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  };

  // Clear All Filters
  const handleClearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPeriodFilter('');
    setApartmentFilter('');
    setCustomerFilter('');
    setGroupBy('none');
    setCurrentPage(1);
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = Boolean(
    searchTerm || statusFilter || periodFilter || apartmentFilter || customerFilter,
  );

  // 1. Deduplicate invoices so one invoice record is displayed only once
  const uniqueInvoices = useMemo(() => {
    const map = new Map<string, Invoice>();
    invoices.forEach((inv) => {
      if (inv && inv.id && !map.has(inv.id)) {
        map.set(inv.id, inv);
      }
    });
    return Array.from(map.values());
  }, [invoices]);

  // Extract distinct available periods and apartments for filter dropdowns
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    uniqueInvoices.forEach((inv) => {
      if (inv.periodCode) set.add(inv.periodCode);
    });
    return Array.from(set).sort().reverse();
  }, [uniqueInvoices]);

  const availableApartments = useMemo(() => {
    const map = new Map<string, string>();
    uniqueInvoices.forEach((inv) => {
      if (inv.apartment?.id) {
        map.set(
          inv.apartment.id,
          `Unit ${inv.apartment.unitNumber}${inv.apartment.tower ? ` (${inv.apartment.tower.name})` : ''}`,
        );
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [uniqueInvoices]);

  // Client-side customer filter if specified
  const filteredInvoices = useMemo(() => {
    if (!customerFilter.trim()) return uniqueInvoices;
    const cLower = customerFilter.toLowerCase().trim();
    return uniqueInvoices.filter((inv) => {
      const owner = (inv.apartment?.ownerName || '').toLowerCase();
      const resident = (inv.apartment?.residentName || '').toLowerCase();
      return owner.includes(cLower) || resident.includes(cLower);
    });
  }, [uniqueInvoices, customerFilter]);

  // Total Outstanding Amount (Accurate, never counting duplicates)
  const totalBilled = useMemo(
    () => filteredInvoices.reduce((sum, inv) => sum + Number(inv.totalDue || 0), 0),
    [filteredInvoices],
  );
  const totalPaid = useMemo(
    () => filteredInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0),
    [filteredInvoices],
  );
  const totalBalanceDue = useMemo(
    () => filteredInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0),
    [filteredInvoices],
  );

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  // Grouped Invoices
  const groupedInvoices = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: { [key: string]: Invoice[] } = {};
    filteredInvoices.forEach((inv) => {
      const key =
        groupBy === 'apartment'
          ? `Unit ${inv.apartment.unitNumber}${inv.apartment.ownerName ? ` — ${inv.apartment.ownerName}` : ''}`
          : `Billing Period: ${inv.billingPeriod?.name || inv.periodCode}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(inv);
    });
    return groups;
  }, [filteredInvoices, groupBy]);

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
            Official condominium maintenance fees, room breakdowns, water bills, and payment records.
          </p>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearAllFilters}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RotateCcw size={14} /> Clear All Filters
          </button>
        )}
      </div>

      {/* Financial Summary KPI Cards (Authoritative, deduplicated calculations) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--color-surface-1)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Total Invoices
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>
            {filteredInvoices.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {uniqueInvoices.length !== filteredInvoices.length
              ? `Filtered from ${uniqueInvoices.length} total`
              : 'Unique billing records'}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--color-surface-1)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Total Billed
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>
            Rs. {totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Gross scheduled charges
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--color-surface-1)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Total Paid
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success-500)', marginTop: '4px' }}>
            Rs. {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Allocated collections
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            background: totalBalanceDue > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            border: totalBalanceDue > 0 ? '1px solid var(--color-danger-500)' : '1px solid var(--color-success-500)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: totalBalanceDue > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)', textTransform: 'uppercase' }}>
            Outstanding Balance
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: totalBalanceDue > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)',
              marginTop: '4px',
            }}
          >
            Rs. {totalBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Net outstanding dues
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'center',
          }}
        >
          {/* Search Input with inline Clear (x) button */}
          <div style={{ flex: 2, minWidth: '260px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              Search Customer, Unit or Invoice #
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
                placeholder="Search Invoice #, Unit (e.g. 1A, A-101), Resident (e.g. Mr. K. Perera)..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{ paddingLeft: '36px', paddingRight: searchTerm ? '36px' : '12px', width: '100%', height: '40px' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  title="Clear search"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'var(--color-surface-3)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              Status
            </label>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0.5rem' }}
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

          {/* Period Code Filter */}
          <div style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              Billing Period
            </label>
            <select
              className="input"
              value={periodFilter}
              onChange={(e) => handlePeriodChange(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0.5rem' }}
            >
              <option value="">All Periods</option>
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Apartment Unit Filter */}
          <div style={{ minWidth: '160px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              Apartment Unit
            </label>
            <select
              className="input"
              value={apartmentFilter}
              onChange={(e) => handleApartmentChange(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0.5rem' }}
            >
              <option value="">All Apartments</option>
              {availableApartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Grouping Toggle */}
          <div style={{ minWidth: '160px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              Group Invoices
            </label>
            <select
              className="input"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              style={{ width: '100%', height: '40px', padding: '0.5rem' }}
            >
              <option value="none">No Grouping</option>
              <option value="apartment">Group by Apartment</option>
              <option value="period">Group by Billing Period</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Active Filters:</span>
            {searchTerm && (
              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                Search: "{searchTerm}"
                <X size={12} style={{ cursor: 'pointer' }} onClick={handleClearSearch} />
              </span>
            )}
            {statusFilter && (
              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                Status: {statusFilter}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleStatusChange('')} />
              </span>
            )}
            {periodFilter && (
              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                Period: {periodFilter}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handlePeriodChange('')} />
              </span>
            )}
            {apartmentFilter && (
              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                Apartment filtered
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleApartmentChange('')} />
              </span>
            )}
            <button
              onClick={handleClearAllFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-brand-400)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginLeft: '6px',
              }}
            >
              Reset All
            </button>
          </div>
        )}
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

      {/* Invoices Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
            <p>Loading invoices and billing statements...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <FileText size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No invoices found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--color-text-secondary)' }}>
              {hasActiveFilters
                ? 'No invoices match your selected filters. Click "Clear All Filters" to view all statements.'
                : 'Generate monthly bills from the Monthly Billing page to view them here.'}
            </p>
            {hasActiveFilters && (
              <button
                className="btn btn-outline"
                onClick={handleClearAllFilters}
                style={{ marginTop: 'var(--space-4)', fontSize: '0.85rem' }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : groupBy !== 'none' && groupedInvoices ? (
          /* Grouped Rendering */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)' }}>
            {Object.entries(groupedInvoices).map(([groupTitle, groupItems]) => {
              const groupTotal = groupItems.reduce((sum, it) => sum + Number(it.totalDue || 0), 0);
              const groupBalance = groupItems.reduce((sum, it) => sum + Number(it.balanceDue || 0), 0);

              return (
                <div
                  key={groupTitle}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--color-surface-2)',
                      padding: '10px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 700,
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <div>{groupTitle}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      {groupItems.length} {groupItems.length === 1 ? 'Invoice' : 'Invoices'} · Total:{' '}
                      <strong>Rs. {groupTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                      {groupBalance > 0 && (
                        <span style={{ color: 'var(--color-danger-500)', marginLeft: '8px' }}>
                          (Due: Rs. {groupBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-1)', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '0.8rem' }}>
                          <th style={{ padding: '8px 12px' }}>Invoice #</th>
                          <th style={{ padding: '8px 12px' }}>Unit</th>
                          <th style={{ padding: '8px 12px' }}>Period</th>
                          <th style={{ padding: '8px 12px' }}>Due Date</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Bill</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Paid</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Balance Due</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupItems.map((inv) => renderInvoiceRow(inv))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Standard Paginated Table */
          <div>
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
                  {paginatedInvoices.map((inv) => renderInvoiceRow(inv))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface-1)',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ color: 'var(--color-text-secondary)' }}>
                Showing{' '}
                <strong>
                  {Math.min((currentPage - 1) * itemsPerPage + 1, filteredInvoices.length)}–
                  {Math.min(currentPage * itemsPerPage, filteredInvoices.length)}
                </strong>{' '}
                of <strong>{filteredInvoices.length}</strong> invoices
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn btn-outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    className={pg === currentPage ? 'btn btn-primary' : 'btn btn-outline'}
                    onClick={() => setCurrentPage(pg)}
                    style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: '32px' }}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  className="btn btn-outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
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

            {/* ─── AUTHENTIC BILL SHEET (IDENTICAL FORMAT TO DOWNLOADED PDF) ─── */}
            <div style={{ maxHeight: '75vh', overflowY: 'auto', padding: 'var(--space-2)' }}>
              <OfficialBillView invoice={selectedInvoice} forwardedRef={printRef} />
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

  // Helper row renderer
  function renderInvoiceRow(inv: Invoice) {
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
            {inv.apartment.ownerName || inv.apartment.residentName || '-'}
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
  }
}
