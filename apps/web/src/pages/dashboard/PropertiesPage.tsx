import { Building2, MapPin, Home, Plus, Search } from 'lucide-react';
import { useState } from 'react';

// Mock data — replace with real API query using TanStack Query
const mockProperties = [
  {
    id: '1',
    name: 'Sunset Apartments',
    address: '123 Sunset Blvd',
    city: 'Austin',
    state: 'TX',
    units: 48,
    occupied: 45,
    status: 'Active',
  },
  {
    id: '2',
    name: 'Maple Grove Complex',
    address: '456 Maple Ave',
    city: 'Dallas',
    state: 'TX',
    units: 32,
    occupied: 28,
    status: 'Active',
  },
  {
    id: '3',
    name: 'River View Towers',
    address: '789 River Rd',
    city: 'Houston',
    state: 'TX',
    units: 60,
    occupied: 58,
    status: 'Active',
  },
  {
    id: '4',
    name: 'Oak Park Residences',
    address: '321 Oak St',
    city: 'San Antonio',
    state: 'TX',
    units: 24,
    occupied: 20,
    status: 'Maintenance',
  },
];

export default function PropertiesPage() {
  const [search, setSearch] = useState('');

  const filtered = mockProperties.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-header__title">Properties</h2>
          <p className="section-header__subtitle">
            {mockProperties.length} properties across your portfolio
          </p>
        </div>
        <button className="btn btn-primary" id="add-property-btn">
          <Plus size={16} />
          Add Property
        </button>
      </div>

      {/* Search bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '0 var(--space-4)',
          marginBottom: 'var(--space-6)',
          maxWidth: '400px',
          transition: 'border-color var(--transition-fast)',
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-brand-500)';
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-subtle)';
        }}
      >
        <Search size={16} color="var(--color-text-muted)" />
        <input
          id="properties-search-input"
          type="text"
          placeholder="Search properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 'var(--space-3) 0',
            fontSize: '0.9rem',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Properties Grid */}
      <div className="grid grid-3">
        {filtered.map((property) => {
          const occupancyRate = Math.round((property.occupied / property.units) * 100);
          return (
            <div key={property.id} className="glass-card" style={{ padding: 'var(--space-6)' }}>
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background:
                      'linear-gradient(135deg, hsl(239, 84%, 60%, 0.2), hsl(265, 89%, 62%, 0.2))',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid hsl(239, 84%, 60%, 0.2)',
                  }}
                >
                  <Building2 size={20} color="hsl(239, 84%, 60%)" />
                </div>
                <span
                  className={
                    property.status === 'Active' ? 'badge badge-success' : 'badge badge-warning'
                  }
                >
                  {property.status}
                </span>
              </div>

              {/* Property Info */}
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                {property.name}
              </h3>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.82rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <MapPin size={12} />
                {property.address}, {property.city}, {property.state}
              </div>

              {/* Stats Row */}
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-4)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {property.units}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Total Units
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {property.occupied}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Occupied
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color:
                        occupancyRate >= 90
                          ? 'hsl(142, 76%, 42%)'
                          : occupancyRate >= 80
                            ? 'hsl(38, 92%, 50%)'
                            : 'hsl(0, 84%, 60%)',
                    }}
                  >
                    {occupancyRate}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Occupancy
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: '6px',
                  background: 'var(--color-surface-3)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${occupancyRate}%`,
                    background:
                      occupancyRate >= 90
                        ? 'linear-gradient(90deg, hsl(142, 76%, 36%), hsl(142, 76%, 50%))'
                        : 'linear-gradient(90deg, hsl(239, 84%, 55%), hsl(265, 89%, 62%))',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                  id={`property-view-${property.id}-btn`}
                >
                  <Home size={13} />
                  View Units
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                  id={`property-edit-${property.id}-btn`}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-16)',
            color: 'var(--color-text-muted)',
          }}
        >
          <Building2 size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.3 }} />
          <p>No properties match your search.</p>
        </div>
      )}
    </div>
  );
}
