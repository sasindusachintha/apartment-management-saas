import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserPlus,
  Search,
  Building,
  Mail,
  Phone,
  Receipt,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  UserX,
} from 'lucide-react';

interface ApartmentRecord {
  id: string;
  unitNumber: string;
  floor: number;
  areaSqft: number;
  status: string;
  isActive: boolean;
  residentName?: string | null;
  residentEmail?: string | null;
  residentPhone?: string | null;
  residentId?: string | null;
  ownerName?: string | null;
  building: {
    id: string;
    name: string;
    code: string;
  };
  tower?: {
    id: string;
    name: string;
  } | null;
  rooms?: Array<{
    id: string;
    roomNumber: string;
    roomType: string;
  }>;
  outstandingArrears?: number;
}

interface RenterEntry {
  id: string;
  apartmentId: string;
  renterName: string;
  email: string;
  phone: string;
  buildingName: string;
  buildingId: string;
  towerName: string;
  floor: number;
  unitNumber: string;
  roomsCount: number;
  tenancyStatus: 'ACTIVE' | 'ENDED' | 'VACANT';
  outstandingArrears: number;
}

export default function RentersPage() {
  const navigate = useNavigate();
  const { activeOrg, hasRole, user: currentUser } = useAuth();
  const isSuperAdmin = !!currentUser?.isPlatformAdmin || hasRole('SUPER_ADMIN');

  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [renters, setRenters] = useState<RenterEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Renter Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
  const [renterName, setRenterName] = useState('');
  const [renterEmail, setRenterEmail] = useState('');
  const [renterPhone, setRenterPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // End Tenancy Modal State
  const [endingRenter, setEndingRenter] = useState<RenterEntry | null>(null);
  const [isEndingTenancy, setIsEndingTenancy] = useState(false);

  // View Details Modal State
  const [detailRenter, setDetailRenter] = useState<RenterEntry | null>(null);

  const fetchRenters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = activeOrg && !isSuperAdmin
        ? `/apartments?organizationId=${activeOrg.id}`
        : '/apartments';
      const { data } = await api.get(url);
      setApartments(data);

      // Extract renter entries from apartments
      const list: RenterEntry[] = [];
      for (const apt of data) {
        if (apt.residentName || apt.residentEmail) {
          list.push({
            id: apt.id,
            apartmentId: apt.id,
            renterName: apt.residentName || 'Unnamed Renter',
            email: apt.residentEmail || '-',
            phone: apt.residentPhone || '-',
            buildingName: apt.building?.name || 'Assigned Building',
            buildingId: apt.building?.id || '',
            towerName: apt.tower?.name || 'Main Tower',
            floor: apt.floor,
            unitNumber: apt.unitNumber,
            roomsCount: apt.rooms?.length || 0,
            tenancyStatus: apt.status === 'OCCUPIED' || apt.status === 'ACTIVE' ? 'ACTIVE' : 'ENDED',
            outstandingArrears: Number(apt.outstandingArrears ?? 0),
          });
        }
      }

      setRenters(list);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load renters';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, isSuperAdmin]);

  useEffect(() => {
    fetchRenters();
  }, [fetchRenters]);

  const handleAddRenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartmentId || !renterName) {
      setModalError('Please select an apartment and enter the renter name.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.post(`/apartments/${selectedApartmentId}/assign-renter`, {
        residentName: renterName.trim(),
        residentEmail: renterEmail.trim() || undefined,
        residentPhone: renterPhone.trim() || undefined,
      });

      setSuccessMsg(`Renter "${renterName}" assigned to apartment successfully.`);
      setShowAddModal(false);
      setSelectedApartmentId('');
      setRenterName('');
      setRenterEmail('');
      setRenterPhone('');
      fetchRenters();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to assign renter to apartment';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndTenancyConfirm = async () => {
    if (!endingRenter) return;
    setIsEndingTenancy(true);
    try {
      await api.post(`/apartments/${endingRenter.apartmentId}/end-tenancy`);
      setSuccessMsg(`Tenancy for ${endingRenter.renterName} has ended. The apartment is now vacant. Historical bills and receipts have been preserved.`);
      setEndingRenter(null);
      fetchRenters();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to end tenancy';
      setError(msg);
    } finally {
      setIsEndingTenancy(false);
    }
  };

  // Unique building names for filter dropdown
  const uniqueBuildings = Array.from(new Set(apartments.map((a) => a.building?.name).filter(Boolean)));

  const filteredRenters = renters.filter((r) => {
    if (buildingFilter !== 'ALL' && r.buildingName !== buildingFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.renterName.toLowerCase().includes(term) ||
      r.email.toLowerCase().includes(term) ||
      r.phone.toLowerCase().includes(term) ||
      r.unitNumber.toLowerCase().includes(term) ||
      r.buildingName.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="section-header__title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} color="var(--color-brand-400)" />
            Renters & Occupants
          </h1>
          <p className="section-header__subtitle">
            Manage apartment customer tenancies, room allocations, and balance status in your properties.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserPlus size={18} />
          Add Renter
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-danger-100)', color: 'var(--color-danger-500)', border: '1px solid var(--color-danger-500)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-100)', color: 'var(--color-success-500)', border: '1px solid var(--color-success-500)', borderRadius: 'var(--radius-md)' }}>
          {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '450px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search renter name, email, unit, or building..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '38px', paddingRight: '12px', height: '40px' }}
          />
        </div>

        {uniqueBuildings.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Building:</span>
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              style={{ height: '40px', padding: '0 12px' }}
            >
              <option value="ALL">All Buildings</option>
              {uniqueBuildings.map((bName, i) => (
                <option key={i} value={bName}>
                  {bName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Renters Table */}
      <div className="table-wrapper">
        <div className="table-header">
          <span className="table-header__title">
            Assigned Renters ({filteredRenters.length})
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Loader2 className="spinner" style={{ margin: '0 auto var(--space-2)' }} />
            Loading renter accounts...
          </div>
        ) : filteredRenters.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No renters found matching your filters.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Renter Name</th>
                <th>Contact Details</th>
                <th>Property & Unit</th>
                <th>Tenancy Status</th>
                <th>Balance Due</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRenters.map((renter) => {
                const hasArrears = renter.outstandingArrears > 0;

                return (
                  <tr key={renter.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-brand-400), var(--color-brand-600))',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                          }}
                        >
                          {renter.renterName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {renter.renterName}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Floor {renter.floor} • Unit {renter.unitNumber}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={13} color="var(--color-text-muted)" />
                          {renter.email}
                        </span>
                        {renter.phone !== '-' && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
                            <Phone size={13} />
                            {renter.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building size={13} color="var(--color-brand-400)" />
                          {renter.buildingName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {renter.towerName} • {renter.roomsCount} Rooms
                        </span>
                      </div>
                    </td>
                    <td>
                      {renter.tenancyStatus === 'ACTIVE' ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Active Tenancy
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={12} /> Ended
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: hasArrears ? 'var(--color-danger-500)' : 'var(--color-success-500)',
                        }}
                      >
                        Rs. {renter.outstandingArrears.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => navigate(`/dashboard/invoices?search=${encodeURIComponent(renter.renterName)}`)}
                          title="View Invoices and Billing history"
                        >
                          <Receipt size={13} />
                          Bills
                        </button>

                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => setDetailRenter(renter)}
                        >
                          Details
                        </button>

                        {renter.tenancyStatus === 'ACTIVE' && (
                          <button
                            className="btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.8rem',
                              border: '1px solid var(--color-danger-500)',
                              color: 'var(--color-danger-500)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onClick={() => setEndingRenter(renter)}
                            title="End Tenancy and preserve records"
                          >
                            <UserX size={13} />
                            End Tenancy
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Renter Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '100%', maxWidth: '520px', padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-1)' }}>Add Renter</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Assign a new resident or tenant to an apartment unit.
            </p>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-danger-100)', color: 'var(--color-danger-500)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddRenter} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Select Apartment Unit *
                </label>
                <select
                  required
                  value={selectedApartmentId}
                  onChange={(e) => setSelectedApartmentId(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="">-- Choose an Apartment --</option>
                  {apartments.map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {apt.building?.name} — Floor {apt.floor}, Unit {apt.unitNumber} {apt.residentName ? `(Currently: ${apt.residentName})` : '(Vacant)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Renter Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Michael Scott"
                  value={renterName}
                  onChange={(e) => setRenterName(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. renter@example.com"
                  value={renterEmail}
                  onChange={(e) => setRenterEmail(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +94 77 987 6543"
                  value={renterPhone}
                  onChange={(e) => setRenterPhone(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !selectedApartmentId || !renterName}
                >
                  {isSubmitting ? 'Assigning...' : 'Assign Renter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Tenancy Confirmation Dialog */}
      {endingRenter && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '100%', maxWidth: '480px', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-3)' }}>
              <AlertCircle size={28} color="var(--color-danger-500)" />
              <h3 style={{ margin: 0 }}>End Tenancy Confirmation</h3>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
              Are you sure you want to end tenancy for <strong>{endingRenter.renterName}</strong> in <strong>{endingRenter.buildingName} • Unit {endingRenter.unitNumber}</strong>?
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
              All previously issued bills, receipts, and payment transactions will remain intact and safely preserved in the database.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEndingRenter(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--color-danger-500)', color: 'white' }}
                disabled={isEndingTenancy}
                onClick={handleEndTenancyConfirm}
              >
                {isEndingTenancy ? 'Processing...' : 'Confirm End Tenancy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renter Details Modal */}
      {detailRenter && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '100%', maxWidth: '520px', padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-1)' }}>Renter Tenancy Details</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Information for {detailRenter.renterName}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Renter Name</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{detailRenter.renterName}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Email</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{detailRenter.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Phone</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{detailRenter.phone}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Building</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{detailRenter.buildingName}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tower / Block</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{detailRenter.towerName}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Unit & Floor</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Unit {detailRenter.unitNumber} (Floor {detailRenter.floor})</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Active Rooms</span>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{detailRenter.roomsCount} Rooms</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Outstanding Arrears</span>
                <div style={{ fontWeight: 700, color: detailRenter.outstandingArrears > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)' }}>
                  Rs. {detailRenter.outstandingArrears.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const rName = detailRenter.renterName;
                  setDetailRenter(null);
                  navigate(`/dashboard/invoices?search=${encodeURIComponent(rName)}`);
                }}
              >
                View Invoices
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDetailRenter(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
