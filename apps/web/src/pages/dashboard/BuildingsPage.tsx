import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Building2, Plus, AlertCircle, Loader2, MapPin } from 'lucide-react';

interface Building {
  id: string;
  name: string;
  address: string;
  status: string;
  organizationId: string;
  createdAt: string;
}

export default function BuildingsPage() {
  const navigate = useNavigate();
  const { activeOrg, hasPermission } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Building Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const canManage = hasPermission('buildings.manage');

  const fetchBuildings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
      const { data } = await api.get(url);
      setBuildings(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch buildings for active organization';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) {
      setModalError('Please fill in both name and address');
      return;
    }

    if (!activeOrg?.id) {
      setModalError('An active organization must be selected first');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.post('/buildings', {
        name,
        address,
        organizationId: activeOrg.id,
      });
      setShowModal(false);
      setName('');
      setAddress('');
      fetchBuildings();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Failed to create building';
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
            Buildings
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Managed apartment buildings scoped to {activeOrg?.name || 'your organization'}
          </p>
        </div>

        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Building
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
            Loading buildings...
          </p>
        </div>
      ) : buildings.length === 0 ? (
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
          <Building2 size={48} color="var(--color-text-muted)" />
          <h3>No Buildings Found</h3>
          <p
            style={{ color: 'var(--color-text-secondary)', maxWidth: '420px', fontSize: '0.9rem' }}
          >
            There are no buildings recorded for this organization yet.
          </p>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create First Building
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-3">
          {buildings.map((b) => (
            <div key={b.id} className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {b.name}
                </h3>
                <span className="badge badge-success">{b.status}</span>
              </div>
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.85rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <MapPin size={14} color="var(--color-brand-400)" /> {b.address}
              </p>
              <div
                style={{
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                    onClick={() => navigate(`/dashboard/building-layout?buildingId=${b.id}`)}
                  >
                    <Building2 size={14} /> Manage Layout & Rooms
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={() => navigate(`/dashboard/apartments?buildingId=${b.id}`)}
                  >
                    Units
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Building ID: <code>{b.id}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Building Modal */}
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
              Add New Building
            </h3>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.85rem',
                marginBottom: 'var(--space-6)',
              }}
            >
              Assign building to: <strong>{activeOrg?.name}</strong>
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
                <label className="form-label" htmlFor="bld-name">
                  Building Name
                </label>
                <input
                  id="bld-name"
                  type="text"
                  className="input"
                  placeholder="e.g. Sunset Heights Apartments"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bld-address">
                  Physical Address
                </label>
                <input
                  id="bld-address"
                  type="text"
                  className="input"
                  placeholder="e.g. 100 Sunset Blvd, Metropolis"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
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
                    'Save Building'
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
