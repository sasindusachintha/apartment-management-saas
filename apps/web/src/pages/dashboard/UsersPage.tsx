import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Users, UserPlus, AlertCircle, Loader2, Shield } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  userRoles: Array<{
    role: { name: string; description: string | null };
    organization?: { name: string } | null;
  }>;
}

export default function UsersPage() {
  const { activeOrg, hasPermission, user: currentUser } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Member Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('BUILDING_OWNER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const canManage = hasPermission('users.manage');

  const handleToggleStatus = async (userId: string, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    setUpdatingUserId(userId);
    try {
      await api.patch(`/users/${userId}/status`, { status: newStatus });
      await fetchUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update user status';
      setError(msg);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = activeOrg ? `/users?organizationId=${activeOrg.id}` : '/users';
      const { data } = await api.get(url);
      setMembers(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch team members';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setModalError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.post('/users', {
        name,
        email,
        password,
        initialRole: role,
        organizationId: activeOrg?.id,
      });
      setShowModal(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('BUILDING_OWNER');
      fetchUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Failed to create team member';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
            Team & Members
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            User memberships and role assignments in {activeOrg?.name || 'your organization'}
          </p>
        </div>

        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <UserPlus size={16} /> Add Member
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: 'hsl(0, 84%, 15%)',
            border: '1px solid var(--color-danger-500)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            color: 'hsl(0, 100%, 90%)',
          }}
        >
          <AlertCircle size={20} color="var(--color-danger-500)" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <Loader2
            size={32}
            style={{ animation: 'spin 1s linear infinite', color: 'var(--color-brand-400)' }}
          />
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-3)' }}>
            Loading team...
          </p>
        </div>
      ) : members.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: 'var(--space-12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <Users size={48} color="var(--color-text-muted)" />
          <h3>No Team Members Found</h3>
          <p
            style={{ color: 'var(--color-text-secondary)', maxWidth: '420px', fontSize: '0.9rem' }}
          >
            There are no members assigned to this organization yet.
          </p>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <UserPlus size={16} /> Add First Member
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <div className="table-header">
            <span className="table-header__title">Organization Members ({members.length})</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Joined</th>
                {currentUser?.isPlatformAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                  </td>
                  <td>{m.email}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {m.userRoles?.map((ur, idx) => (
                        <span key={idx} className="badge badge-primary">
                          <Shield size={12} style={{ marginRight: '4px' }} />
                          {ur.role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${m.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  {currentUser?.isPlatformAdmin && (
                    <td>
                      {m.id !== currentUser.id && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            borderColor:
                              m.status === 'ACTIVE'
                                ? 'rgba(239, 68, 68, 0.5)'
                                : 'rgba(34, 197, 94, 0.5)',
                            color:
                              m.status === 'ACTIVE'
                                ? 'var(--color-danger-400)'
                                : 'var(--color-success-400)',
                          }}
                          disabled={updatingUserId === m.id}
                          onClick={() =>
                            handleToggleStatus(
                              m.id,
                              m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                            )
                          }
                        >
                          {updatingUserId === m.id
                            ? 'Updating...'
                            : m.status === 'ACTIVE'
                            ? 'Suspend'
                            : 'Activate'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Member Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-8)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.3rem',
                marginBottom: 'var(--space-2)',
              }}
            >
              Add Team Member
            </h3>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.85rem',
                marginBottom: 'var(--space-6)',
              }}
            >
              Add a user to <strong>{activeOrg?.name}</strong>
            </p>

            {modalError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  background: 'hsl(0, 84%, 15%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  color: 'hsl(0, 100%, 90%)',
                  fontSize: '0.85rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={16} color="var(--color-danger-500)" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={handleCreate}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="mem-name">
                  Full Name
                </label>
                <input
                  id="mem-name"
                  type="text"
                  className="input"
                  placeholder="e.g. Carol Davis"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mem-email">
                  Email Address
                </label>
                <input
                  id="mem-email"
                  type="email"
                  className="input"
                  placeholder="e.g. carol@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mem-pass">
                  Initial Password
                </label>
                <input
                  id="mem-pass"
                  type="password"
                  className="input"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mem-role">
                  Assigned Role
                </label>
                <select
                  id="mem-role"
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="BUILDING_OWNER">BUILDING_OWNER (Assigned building management & layout)</option>
                  <option value="RENTER">RENTER (Resident / Tenant with view access)</option>
                  {currentUser?.isPlatformAdmin && (
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Platform Administrator)</option>
                  )}
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--space-3)',
                  marginTop: 'var(--space-4)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Saving...
                    </>
                  ) : (
                    'Add Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
