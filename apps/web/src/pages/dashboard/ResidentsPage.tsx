import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Search,
  Home,
  Phone,
  Mail,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface OccupantApartment {
  id: string;
  unitNumber: string;
  floor: number;
  buildingName: string;
  areaSqft: number;
  outstandingArrears: number;
}

interface Occupant {
  id: string;
  name: string;
  role: 'OWNER' | 'RESIDENT';
  phone: string;
  email: string;
  apartments: OccupantApartment[];
  totalArrears: number;
}

export default function ResidentsPage() {
  const { activeOrg } = useAuth();
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'OWNER' | 'RESIDENT'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOccupants = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = activeOrg ? `/apartments?organizationId=${activeOrg.id}` : '/apartments';
      const { data } = await api.get(url);

      // Group into unique occupants by name + phone
      const map = new Map<string, Occupant>();

      for (const apt of data) {
        const arrears = Number(apt.outstandingArrears ?? 0);
        const bldgName = apt.building?.name || 'Building';

        // Add Owner
        if (apt.ownerName) {
          const key = `OWNER_${apt.ownerName}_${apt.ownerPhone || ''}`;
          const existing: Occupant = map.get(key) || {
            id: key,
            name: apt.ownerName,
            role: 'OWNER' as const,
            phone: apt.ownerPhone || '-',
            email: apt.ownerEmail || '-',
            apartments: [] as OccupantApartment[],
            totalArrears: 0,
          };
          existing.apartments.push({
            id: apt.id,
            unitNumber: apt.unitNumber,
            floor: apt.floor,
            buildingName: bldgName,
            areaSqft: Number(apt.areaSqft),
            outstandingArrears: arrears,
          });
          existing.totalArrears += arrears;
          map.set(key, existing);
        }

        // Add Resident if distinct
        if (apt.residentName && apt.residentName !== apt.ownerName) {
          const key = `RESIDENT_${apt.residentName}_${apt.residentPhone || ''}`;
          const existing: Occupant = map.get(key) || {
            id: key,
            name: apt.residentName,
            role: 'RESIDENT' as const,
            phone: apt.residentPhone || apt.ownerPhone || '-',
            email: apt.residentEmail || apt.ownerEmail || '-',
            apartments: [] as OccupantApartment[],
            totalArrears: 0,
          };
          existing.apartments.push({
            id: apt.id,
            unitNumber: apt.unitNumber,
            floor: apt.floor,
            buildingName: bldgName,
            areaSqft: Number(apt.areaSqft),
            outstandingArrears: arrears,
          });
          existing.totalArrears += arrears;
          map.set(key, existing);
        }
      }

      setOccupants(Array.from(map.values()));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch residents and owners';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    fetchOccupants();
  }, [fetchOccupants]);

  const filteredOccupants = occupants.filter((o) => {
    if (roleFilter !== 'ALL' && o.role !== roleFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = o.name.toLowerCase().includes(term);
      const matchPhone = o.phone.toLowerCase().includes(term);
      const matchEmail = o.email.toLowerCase().includes(term);
      const matchUnit = o.apartments.some((a) => a.unitNumber.toLowerCase().includes(term));
      return matchName || matchPhone || matchEmail || matchUnit;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
          }}
        >
          Residents & Apartment Owners
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Directory of registered condominium owners, resident tenants, contact details, and account balances.
        </p>
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
        <div style={{ minWidth: '180px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Category
          </label>
          <select
            className="input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="ALL">All Occupants</option>
            <option value="OWNER">Apartment Owners</option>
            <option value="RESIDENT">Resident Tenants</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '240px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Search Occupant or Apartment
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
              placeholder="Search by name, phone, email, or unit number..."
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

      {/* Directory Grid */}
      {isLoading ? (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
          <p>Loading directory...</p>
        </div>
      ) : filteredOccupants.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <Users size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
          <p style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>No occupants found</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
          {filteredOccupants.map((occ) => (
            <div key={occ.id} className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {occ.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span
                      className={`badge ${occ.role === 'OWNER' ? 'badge-primary' : 'badge-warning'}`}
                      style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
                    >
                      {occ.role === 'OWNER' ? 'Property Owner' : 'Resident Tenant'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {occ.apartments.length} {occ.apartments.length === 1 ? 'Unit' : 'Units'}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Outstanding Dues
                  </div>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: occ.totalArrears > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)',
                    }}
                  >
                    Rs. {occ.totalArrears.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div
                style={{
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={14} color="var(--color-brand-400)" />
                  <span>{occ.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={14} color="var(--color-accent-400)" />
                  <span>{occ.email}</span>
                </div>
              </div>

              {/* Assigned Apartments list */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Associated Apartments:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {occ.apartments.map((a) => (
                    <span
                      key={a.id}
                      style={{
                        background: 'var(--color-surface-3)',
                        border: '1px solid var(--color-border)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Home size={12} color="var(--color-brand-400)" />
                      {a.buildingName} - Unit {a.unitNumber} ({a.areaSqft} sq ft)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
