import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  Home,
  Layers,
  Maximize2,
  FileText,
  DollarSign,
  AlertCircle,
  Info,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  areaSqft: number | string;
  maintenanceRate?: number | string | null;
  applicableRate: number | string;
  monthlyCharge: number | string;
  isActive: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number | string;
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
  status: string;
  residentName?: string | null;
  residentEmail?: string | null;
  residentPhone?: string | null;
  ownerName?: string | null;
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
  rooms: Room[];
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
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetchMyApartment();
  }, []);

  const fetchMyApartment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/apartments/my-apartment');
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load my apartment:', err);
      setError(
        err.response?.data?.message ||
          'No active apartment lease was found for your account. Please contact your property manager.',
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `LKR ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div className="spinner" style={{ margin: '0 auto var(--space-4)' }} />
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading your apartment profile...</p>
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
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-8)',
          }}
        >
          <AlertCircle size={48} color="var(--color-warning-500)" style={{ margin: '0 auto var(--space-4)' }} />
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Apartment Access Notice</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
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

  return (
    <div className="page-container">
      {/* Page Title & Building Context */}
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-primary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Renter Portal
            </span>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} /> Active Tenancy
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            My Apartment: {data.unitNumber}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            {data.building.name} • {data.tower?.name || 'Main Tower'} • Floor {data.floor}
          </p>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
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
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              UNIT NUMBER
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{data.unitNumber}</div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
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
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              TOTAL AREA
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{Number(data.totalRoomArea || data.areaSqft)} sq ft</div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
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
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              ROOMS COUNT
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{data.rooms.length} Rooms</div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-2)',
            border: arrearsNum > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: arrearsNum > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: arrearsNum > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)',
            }}
          >
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              OUTSTANDING BALANCE
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: arrearsNum > 0 ? 'var(--color-danger-400)' : 'var(--color-success-500)',
              }}
            >
              {formatCurrency(data.outstandingArrears)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Cinema Room Map & Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-6)' }}>
        {/* Cinema Room Layout Container */}
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--color-brand-400)" />
                Apartment Room Layout
              </h2>
              <p style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Cinema seat-style room composition and area breakdown for Unit {data.unitNumber}.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} />
              Active Room
            </div>
          </div>

          {/* Screen bar */}
          <div className="cinema-screen-corridor">
            <div className="cinema-screen-bar" style={{ maxWidth: '400px' }}>
              MAIN ENTRANCE / BALCONY VIEW
            </div>
          </div>

          {/* Room Seat Grid */}
          {data.rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>
              <Layers size={32} style={{ margin: '0 auto var(--space-2)', opacity: 0.5 }} />
              <p>No individual rooms have been defined for this unit.</p>
            </div>
          ) : (
            <div className="cinema-room-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              {data.rooms.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    className="cinema-room-card"
                    style={{
                      outline: isSelected ? '2px solid var(--color-brand-400)' : 'none',
                      boxShadow: isSelected ? '0 0 16px rgba(59, 130, 246, 0.4)' : undefined,
                    }}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="cinema-room-card__header">
                      <span className="cinema-room-card__number">{room.roomNumber}</span>
                      <span className="cinema-room-card__status-dot" title="Active Room" />
                    </div>
                    <div className="cinema-room-card__type">{room.roomType}</div>
                    <div className="cinema-room-card__area">{Number(room.areaSqft)} sq ft</div>
                    <div className="cinema-room-card__rate">
                      Rate: {formatCurrency(room.applicableRate)} / sq ft
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Room Details Panel */}
          {selectedRoom && (
            <div
              style={{
                marginTop: 'var(--space-6)',
                padding: 'var(--space-4)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  Room: {selectedRoom.roomNumber} ({selectedRoom.roomType})
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Area: {Number(selectedRoom.areaSqft)} sq ft • Monthly Service Allocation:{' '}
                  <strong>{formatCurrency(selectedRoom.monthlyCharge)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => setSelectedRoom(null)}
              >
                Close Room Details
              </button>
            </div>
          )}
        </div>

        {/* Tenancy & Financial Information Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
          {/* Tenancy Details */}
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} color="var(--color-brand-400)" />
              Tenancy Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Assigned Resident:</span>
                <span style={{ fontWeight: 600 }}>{data.residentName || 'Self'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Resident Email:</span>
                <span style={{ fontWeight: 500 }}>{data.residentEmail || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Resident Contact:</span>
                <span style={{ fontWeight: 500 }}>{data.residentPhone || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Building Address:</span>
                <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '200px' }}>{data.building.address}</span>
              </div>
            </div>
          </div>

          {/* Recent Invoices */}
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--color-brand-400)" />
              Recent Bills & Invoices
            </h3>
            {data.invoices.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                No invoices found for this unit.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{formatCurrency(inv.totalAmount)}</div>
                      <span
                        className={`badge ${
                          inv.status === 'PAID'
                            ? 'badge-success'
                            : inv.status === 'OVERDUE'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
