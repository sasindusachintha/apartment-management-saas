import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Building,
  Mail,
  Phone,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface BuildingItem {
  id: string;
  name: string;
  code: string;
  address?: string | null;
}

interface OwnerUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt: string;
  userRoles: Array<{
    id: string;
    role: { name: string; description: string | null };
    organization?: { id: string; name: string } | null;
    building?: { id: string; name: string } | null;
  }>;
}

export default function BuildingOwnersPage() {
  const { hasRole, user: currentUser } = useAuth();
  const isSuperAdmin = !!currentUser?.isPlatformAdmin || hasRole('SUPER_ADMIN');

  const [owners, setOwners] = useState<OwnerUser[]>([]);
  const [buildings, setBuildings] = useState<BuildingItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Owner Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Assign Building Modal
  const [assignOwner, setAssignOwner] = useState<OwnerUser | null>(null);
  const [assignBuildingId, setAssignBuildingId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Status toggle
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchOwnersAndBuildings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, buildingsRes] = await Promise.all([
        api.get('/users'),
        api.get('/buildings'),
      ]);

      // Filter only building owners (do not mix renters or standard users)
      const ownerList = usersRes.data.filter((u: OwnerUser) =>
        u.userRoles.some((ur) => ur.role.name === 'BUILDING_OWNER'),
      );
      setOwners(ownerList);
      setBuildings(buildingsRes.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load building owners';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwnersAndBuildings();
  }, [fetchOwnersAndBuildings]);

  const handleToggleStatus = async (owner: OwnerUser) => {
    const newStatus = owner.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'reactivate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${owner.name}?`)) {
      return;
    }

    setUpdatingUserId(owner.id);
    try {
      await api.patch(`/users/${owner.id}/status`, { status: newStatus });
      setSuccessMsg(`Building owner ${owner.name} has been ${newStatus === 'ACTIVE' ? 'reactivated' : 'suspended'}.`);
      await fetchOwnersAndBuildings();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update owner status';
      setError(msg);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      setModalError('Please fill in name, email, and a secure password.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.post('/users', {
        name: newName,
        email: newEmail,
        phone: newPhone || undefined,
        password: newPassword,
        initialRole: 'BUILDING_OWNER',
        buildingId: selectedBuildingId || undefined,
      });

      setSuccessMsg(`Building owner "${newName}" created successfully.`);
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setSelectedBuildingId('');
      fetchOwnersAndBuildings();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to create building owner';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignOwner || !assignBuildingId) return;

    setIsAssigning(true);
    try {
      await api.post(`/users/${assignOwner.id}/roles`, {
        roleName: 'BUILDING_OWNER',
        buildingId: assignBuildingId,
      });
      setSuccessMsg(`Building assigned to ${assignOwner.name} successfully.`);
      setAssignOwner(null);
      setAssignBuildingId('');
      fetchOwnersAndBuildings();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to assign building';
      setError(msg);
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredOwners = owners.filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const bldgs = o.userRoles.map((r) => r.building?.name || '').join(' ').toLowerCase();
    return (
      o.name.toLowerCase().includes(term) ||
      o.email.toLowerCase().includes(term) ||
      (o.phone && o.phone.toLowerCase().includes(term)) ||
      bldgs.includes(term)
    );
  });

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--color-danger-500)" style={{ margin: '0 auto var(--space-3)' }} />
          <h3>Access Restricted</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            Only Platform Super Administrators have permission to manage Building Owner accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="section-header__title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="var(--color-brand-400)" />
            Building Owners
          </h1>
          <p className="section-header__subtitle">
            Manage registered building and property owners across the ApartmentSaaS platform.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserPlus size={18} />
          Add Building Owner
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

      {/* Filters Bar */}
      <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '450px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search by owner name, email, or building..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '38px', paddingRight: '12px', height: '40px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED')}
            style={{ height: '40px', padding: '0 12px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Owners Table */}
      <div className="table-wrapper">
        <div className="table-header">
          <span className="table-header__title">
            Registered Building Owners ({filteredOwners.length})
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Loader2 className="spinner" style={{ margin: '0 auto var(--space-2)' }} />
            Loading building owner accounts...
          </div>
        ) : filteredOwners.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No building owners found matching your criteria.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Owner Details</th>
                <th>Contact</th>
                <th>Assigned Buildings</th>
                <th>Status</th>
                <th>Date Registered</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOwners.map((owner) => {
                const assignedBldgs = owner.userRoles
                  .map((ur) => ur.building?.name)
                  .filter(Boolean) as string[];

                return (
                  <tr key={owner.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-accent-500))',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                          }}
                        >
                          {owner.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{owner.name}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>ID: {owner.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={13} color="var(--color-text-muted)" />
                          {owner.email}
                        </span>
                        {owner.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
                            <Phone size={13} />
                            {owner.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {assignedBldgs.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {assignedBldgs.map((bName, idx) => (
                            <span
                              key={idx}
                              className="badge badge-brand"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Building size={11} />
                              {bName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          No buildings assigned
                        </span>
                      )}
                    </td>
                    <td>
                      {owner.status === 'ACTIVE' ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={12} /> {owner.status}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {new Date(owner.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => {
                            setAssignOwner(owner);
                            setAssignBuildingId('');
                          }}
                        >
                          Assign Building
                        </button>
                        <button
                          className="btn"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                            border: '1px solid',
                            borderColor: owner.status === 'ACTIVE' ? 'var(--color-danger-500)' : 'var(--color-success-500)',
                            color: owner.status === 'ACTIVE' ? 'var(--color-danger-500)' : 'var(--color-success-500)',
                          }}
                          disabled={updatingUserId === owner.id}
                          onClick={() => handleToggleStatus(owner)}
                        >
                          {updatingUserId === owner.id
                            ? 'Updating...'
                            : owner.status === 'ACTIVE'
                            ? 'Suspend'
                            : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Owner Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '100%', maxWidth: '520px', padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-1)' }}>Add Building Owner</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Create a new building owner account and assign an initial property.
            </p>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-danger-100)', color: 'var(--color-danger-500)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateOwner} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Vance"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. owner@properties.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +94 77 123 4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Initial Password * (minimum 8 characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Assign Primary Building
                </label>
                <select
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="">-- Select a Building (or assign later) --</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
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
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Owner...' : 'Create Building Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Building Modal */}
      {assignOwner && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '100%', maxWidth: '480px', padding: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-1)' }}>Assign Building to Owner</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Assign property management authority for <strong>{assignOwner.name}</strong>.
            </p>

            <form onSubmit={handleAssignBuilding} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Select Building to Assign
                </label>
                <select
                  required
                  value={assignBuildingId}
                  onChange={(e) => setAssignBuildingId(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="">-- Choose Building --</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setAssignOwner(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isAssigning || !assignBuildingId}
                >
                  {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
