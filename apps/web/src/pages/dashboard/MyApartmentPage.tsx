import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../lib/api';
import {
  Home,
  Layers,
  Maximize2,
  FileText,
  DollarSign,
  AlertCircle,
  Building as BuildingIcon,
  User,
  ShieldCheck,
  CreditCard,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Eye,
  Download,
  Printer,
  X,
} from 'lucide-react';
import OfficialBillView from '../../components/OfficialBillView';

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodCode?: string | null;
  issueDate: string;
  dueDate: string;
  totalDue: number | string;
  paidAmount?: number | string | null;
  balanceDue: number | string;
  status: string;
}

interface Payment {
  id: string;
  paymentDate: string;
  amount: number | string;
  paymentMethod: string;
  referenceNumber?: string | null;
}

interface MyApartmentData {
  id: string;
  unitNumber: string;
  floor: number;
  areaSqft: number | string;
  roomCount?: number;
  roomsCount?: number;
  status: string;
  residentName?: string | null;
  residentEmail?: string | null;
  residentPhone?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  notes?: string | null;
  building: {
    id: string;
    name: string;
    address: string;
  };
  tower?: {
    id: string;
    name: string;
    code: string;
  } | null;
  rooms: Array<{ id: string; roomNumber: string; roomType: string; areaSqft: number | string }>;
  invoices: Invoice[];
  payments: Payment[];
  totalRoomArea: number | string;
  totalRoomCharge: number | string;
  outstandingArrears: number | string;
}

export default function MyApartmentPage() {
  const [data, setData] = useState<MyApartmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMyApartment();
  }, []);

  const handleViewBill = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setShowBillModal(true);
    try {
      const { data: fullInvoice } = await api.get(`/billing/invoices/${inv.id}`);
      setSelectedInvoice(fullInvoice);
    } catch {
      setSelectedInvoice(inv);
    }
  };

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
    } catch (err: unknown) {
      console.error('Failed to download invoice PDF', err);
      alert('Failed to download invoice PDF');
    }
  };

  const fetchMyApartment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/apartments/my-apartment');
      setData(res.data);
    } catch (err: unknown) {
      console.error('Failed to load my apartment:', err);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No active apartment lease was found for your account. Please contact your property manager.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `LKR ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Deduplicate invoices safely
  const uniqueInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    const seen = new Set<string>();
    const list: Invoice[] = [];
    for (const inv of data.invoices) {
      if (!seen.has(inv.id)) {
        seen.add(inv.id);
        list.push(inv);
      }
    }
    return list;
  }, [data?.invoices]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div className="spinner" style={{ margin: '0 auto var(--space-4)' }} />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Loading your apartment profile...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container" style={{ maxWidth: '640px', margin: '4rem auto', textAlign: 'center' }}>
        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-8)',
          }}
        >
          <AlertCircle size={48} color="var(--color-warning-500)" style={{ margin: '0 auto var(--space-4)' }} />
          <h2 style={{ marginBottom: 'var(--space-2)', fontSize: '1.4rem', fontWeight: 800 }}>Apartment Access Notice</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.6, fontSize: '0.9rem' }}>
            {error}
          </p>
          <button className="btn btn-primary" onClick={fetchMyApartment}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const arrearsNum = Number(data.outstandingArrears || 0);
  const totalRooms = data.roomsCount ?? data.roomCount ?? (data.rooms?.length > 0 ? data.rooms.length : 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
      {/* ─── 1. PAGE TITLE & STATUS BADGE ───────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          background: 'var(--color-surface)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-primary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
              Resident Portal
            </span>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
              <ShieldCheck size={12} /> Active Tenancy
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
            My Apartment: Unit {data.unitNumber}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '4px', margin: 0 }}>
            {data.building.name} {data.tower ? `• ${data.tower.name} ` : ''}• Floor {data.floor} • {Number(data.areaSqft).toLocaleString()} sq ft
          </p>
        </div>

        <button
          className="btn btn-outline"
          onClick={fetchMyApartment}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={15} />
          <span>Refresh Details</span>
        </button>
      </div>

      {/* ─── 2. STAT KPI SUMMARY CARDS ───────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Apartment Unit */}
        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand-400)',
            }}
          >
            <Home size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Apartment Unit
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {data.unitNumber}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Floor {data.floor} {data.tower ? `• ${data.tower.name}` : ''}
            </div>
          </div>
        </div>

        {/* Floor Area */}
        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-success-500)',
            }}
          >
            <Maximize2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Area
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {Number(data.areaSqft).toLocaleString()} sq ft
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Authoritative Dimensions
            </div>
          </div>
        </div>

        {/* Total Rooms Concept */}
        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a78bfa',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Rooms
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Apartment Layout
            </div>
          </div>
        </div>

        {/* Outstanding Arrears Balance */}
        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            background: arrearsNum > 0 ? 'hsl(0, 84%, 10%)' : 'var(--color-surface)',
            border: arrearsNum > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              background: arrearsNum > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: arrearsNum > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)',
            }}
          >
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Outstanding Balance
            </div>
            <div
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: arrearsNum > 0 ? 'var(--color-danger-400)' : 'var(--color-success-500)',
              }}
            >
              {formatCurrency(data.outstandingArrears)}
            </div>
            <div style={{ fontSize: '0.75rem', color: arrearsNum > 0 ? 'var(--color-danger-400)' : 'var(--color-success-400)' }}>
              {arrearsNum > 0 ? 'Payment Required' : 'All Clear / Paid'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. STRUCTURED DETAILS CARDS ─────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Card 1: Building & Floor Information */}
        <div
          className="card"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
            <BuildingIcon size={18} color="var(--color-brand-400)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Building & Property Specs
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Complex Name</span>
              <span style={{ fontWeight: 600 }}>{data.building.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Address</span>
              <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '200px' }}>{data.building.address}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Tower / Block</span>
              <span style={{ fontWeight: 600 }}>{data.tower ? `${data.tower.name} (${data.tower.code})` : 'Main Tower'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Floor Level</span>
              <span style={{ fontWeight: 600 }}>Floor {data.floor}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Total Rooms</span>
              <span style={{ fontWeight: 700, color: 'var(--color-brand-400)' }}>{totalRooms} Rooms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Floor Area</span>
              <span style={{ fontWeight: 700 }}>{Number(data.areaSqft).toLocaleString()} sq ft</span>
            </div>
          </div>
        </div>

        {/* Card 2: Resident & Owner Information */}
        <div
          className="card"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
            <User size={18} color="var(--color-brand-400)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Occupant & Owner Particulars
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Assigned Resident</span>
              <span style={{ fontWeight: 600 }}>{data.residentName || data.ownerName || 'Self'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Resident Contact</span>
              <span style={{ fontWeight: 500 }}>{data.residentPhone || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Resident Email</span>
              <span style={{ fontWeight: 500 }}>{data.residentEmail || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Property Owner</span>
              <span style={{ fontWeight: 600 }}>{data.ownerName || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Owner Phone</span>
              <span style={{ fontWeight: 500 }}>{data.ownerPhone || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Tenancy Status</span>
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                {data.status}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Billing & Financial Summary */}
        <div
          className="card"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
            <CreditCard size={18} color="var(--color-brand-400)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Billing Summary & Allocation
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Monthly Service Allocation</span>
              <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {formatCurrency(data.totalRoomCharge)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Total Outstanding Arrears</span>
              <span style={{ fontWeight: 800, color: arrearsNum > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)' }}>
                {formatCurrency(data.outstandingArrears)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Billing Status</span>
              <span className={`badge ${arrearsNum > 0 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.75rem' }}>
                {arrearsNum > 0 ? 'Pending Payment' : 'Up to Date'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Payment Method</span>
              <span style={{ fontWeight: 500 }}>Bank Transfer / Online Portal</span>
            </div>

            {arrearsNum === 0 && (
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  background: 'hsl(142, 70%, 10%)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-success-400)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>All apartment dues are completely settled.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4. TENANT INVOICES TABLE (CLEAN & DEDUPLICATED) ─── */}
      <div
        className="card"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--color-brand-400)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)' }}>
                Billing Statements & Invoices
              </h3>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.825rem', marginTop: '2px', margin: 0 }}>
              Official monthly condominium maintenance invoices issued for Unit {data.unitNumber}
            </p>
          </div>

          <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
            {uniqueInvoices.length} {uniqueInvoices.length === 1 ? 'Invoice' : 'Invoices'}
          </span>
        </div>

        {uniqueInvoices.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <FileText size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No invoices on record</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              There are currently no maintenance invoices issued for this apartment unit.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Invoice #</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Billing Period</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Issue Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Due Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Paid Amount</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Outstanding Balance</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uniqueInvoices.map((inv) => {
                  const bal = Number(inv.balanceDue ?? 0);
                  const isPaid = inv.status === 'PAID' || bal === 0;

                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Invoice # */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-brand-400)' }}>
                        {inv.invoiceNumber}
                      </td>

                      {/* Billing Period */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--color-surface-2)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                          }}
                        >
                          <Calendar size={12} />
                          {inv.periodCode || '—'}
                        </span>
                      </td>

                      {/* Issue Date */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                        {new Date(inv.issueDate).toLocaleDateString()}
                      </td>

                      {/* Due Date */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(inv.totalDue)}
                      </td>

                      {/* Paid Amount */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: 'var(--color-success-500)', fontWeight: 600 }}>
                        {formatCurrency(inv.paidAmount ?? 0)}
                      </td>

                      {/* Balance Due */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700 }}>
                        {bal > 0 ? (
                          <span style={{ color: 'var(--color-danger-500)' }}>
                            {formatCurrency(bal)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-success-500)' }}>LKR 0.00</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <span
                          className={`badge ${
                            isPaid
                              ? 'badge-success'
                              : inv.status === 'OVERDUE'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                        >
                          {isPaid ? 'PAID' : inv.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn btn-outline"
                            title="View Official Bill (Same as Downloaded PDF)"
                            onClick={() => handleViewBill(inv)}
                            style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={13} color="var(--color-brand-400)" />
                            <span>View Bill</span>
                          </button>
                          <button
                            className="btn btn-outline"
                            title="Download PDF Bill"
                            onClick={() => downloadPdf(inv.id)}
                            style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>
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

      {/* ─── OFFICIAL BILL PREVIEW MODAL (IDENTICAL FORMAT TO DOWNLOADED PDF) ─── */}
      {showBillModal && selectedInvoice && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '780px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <span className={`badge ${selectedInvoice.status === 'PAID' ? 'badge-success' : selectedInvoice.status === 'OVERDUE' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.7rem', marginBottom: '4px' }}>
                  {selectedInvoice.status}
                </span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0, fontSize: '1.2rem' }}>
                  Maintenance & Water Bill #{selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => window.print()}
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
                <button className="btn-ghost" onClick={() => setShowBillModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Authentic PDF Format View */}
            <div style={{ maxHeight: '75vh', overflowY: 'auto', padding: 'var(--space-2)' }}>
              <OfficialBillView invoice={selectedInvoice} forwardedRef={printRef} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button className="btn btn-outline" onClick={() => setShowBillModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
