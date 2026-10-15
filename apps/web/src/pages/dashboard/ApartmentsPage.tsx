import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Home,
  Eye,
  Edit2,
  Trash2,
  X,
  Layers,
  Building as BuildingIcon,
} from 'lucide-react';

interface Tower {
  id: string;
  name: string;
  code?: string | null;
  totalFloors?: number | null;
  description?: string | null;
  isActive: boolean;
  _count?: { apartments: number };
}

interface Apartment {
  id: string;
  unitNumber: string;
  floor: number;
  areaSqft: number | string;
  roomCount?: number;
  status: string;
  isActive: boolean;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  residentName?: string | null;
  residentEmail?: string | null;
  residentPhone?: string | null;
  notes?: string | null;
  buildingId: string;
  towerId?: string | null;
  tower?: Tower | null;
  rooms?: Array<{ id: string; roomNumber: string; roomType: string; areaSqft: number | string }>;
  _count?: { rooms: number };
  building?: { id: string; name: string; address: string };
  outstandingArrears?: number | string;
}

interface Building {
  id: string;
  name: string;
}

export default function ApartmentsPage() {
  const { activeOrg, hasPermission } = useAuth();

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedTowerId, setSelectedTowerId] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Unified Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTowersModal, setShowTowersModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Apartment | null>(null);

  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Tower Form
  const [towerForm, setTowerForm] = useState({
    name: '',
    code: '',
    totalFloors: 10,
    description: '',
  });

  // Unified Apartment Add/Edit Form State
  const [formData, setFormData] = useState({
    unitNumber: '',
    floor: 1,
    towerId: '',
    areaSqft: 1000,
    roomCount: 2,
    status: 'ACTIVE',
    buildingId: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    residentName: '',
    residentEmail: '',
    residentPhone: '',
    notes: '',
  });

  const canManage = hasPermission('apartments.manage');

  // Auto-clear feedback toast after 5s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Fetch Buildings
  const fetchBuildings = useCallback(async () => {
    try {
      const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
      const { data } = await api.get(url);
      setBuildings(data);
      if (data.length > 0 && !selectedBuildingId) {
        setSelectedBuildingId(data[0].id);
      }
    } catch {
      // Ignore initial load error
    }
  }, [activeOrg, selectedBuildingId]);

  // Fetch Towers for selected Building
  const fetchTowers = useCallback(async () => {
    if (!selectedBuildingId) {
      setTowers([]);
      return;
    }
    try {
      const { data } = await api.get(`/apartments/towers/list?buildingId=${selectedBuildingId}`);
      setTowers(data);
    } catch {
      setTowers([]);
    }
  }, [selectedBuildingId]);

  // Fetch Apartments
  const fetchApartments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/apartments?`;
      if (activeOrg) url += `organizationId=${activeOrg.id}&`;
      if (selectedBuildingId) url += `buildingId=${selectedBuildingId}&`;
      if (selectedTowerId) url += `towerId=${selectedTowerId}&`;
      if (selectedFloor) url += `floor=${selectedFloor}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;

      const { data } = await api.get(url);
      setApartments(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch apartments';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, selectedBuildingId, selectedTowerId, selectedFloor, statusFilter, searchTerm]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    fetchTowers();
  }, [fetchTowers]);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  // Open Add Modal
  const openAddModal = () => {
    setModalMode('add');
    setSelectedApartment(null);
    setFormData({
      unitNumber: '',
      floor: 1,
      towerId: selectedTowerId || '',
      areaSqft: 1000,
      roomCount: 2,
      status: 'ACTIVE',
      buildingId: selectedBuildingId || (buildings[0]?.id ?? ''),
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '',
      residentName: '',
      residentEmail: '',
      residentPhone: '',
      notes: '',
    });
    setModalError(null);
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (apt: Apartment) => {
    setModalMode('edit');
    setSelectedApartment(apt);
    setFormData({
      unitNumber: apt.unitNumber,
      floor: apt.floor,
      towerId: apt.towerId || '',
      areaSqft: Number(apt.areaSqft),
      roomCount: apt.roomCount ?? (apt._count?.rooms || apt.rooms?.length || 2),
      status: apt.status,
      buildingId: apt.buildingId,
      ownerName: apt.ownerName || '',
      ownerEmail: apt.ownerEmail || '',
      ownerPhone: apt.ownerPhone || '',
      residentName: apt.residentName || '',
      residentEmail: apt.residentEmail || '',
      residentPhone: apt.residentPhone || '',
      notes: apt.notes || '',
    });
    setModalError(null);
    setShowModal(true);
  };

  // Handle Save (Add or Edit)
  const handleSaveApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id) return;

    if (!formData.unitNumber.trim()) {
      setModalError('Apartment / Unit number is required');
      return;
    }
    if (!formData.areaSqft || Number(formData.areaSqft) <= 0) {
      setModalError('Please enter a valid floor area in square feet');
      return;
    }
    if (!formData.roomCount || Number(formData.roomCount) < 1) {
      setModalError('Room count must be at least 1');
      return;
    }

    const bldgId = formData.buildingId || selectedBuildingId;
    if (!bldgId) {
      setModalError('Please select a building');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      if (modalMode === 'add') {
        await api.post('/apartments', {
          organizationId: activeOrg.id,
          buildingId: bldgId,
          towerId: formData.towerId || undefined,
          unitNumber: formData.unitNumber.trim(),
          floor: Number(formData.floor),
          areaSqft: Number(formData.areaSqft),
          roomCount: Number(formData.roomCount),
          status: formData.status,
          ownerName: formData.ownerName.trim() || undefined,
          ownerEmail: formData.ownerEmail.trim() || undefined,
          ownerPhone: formData.ownerPhone.trim() || undefined,
          residentName: formData.residentName.trim() || formData.ownerName.trim() || undefined,
          residentEmail: formData.residentEmail.trim() || formData.ownerEmail.trim() || undefined,
          residentPhone: formData.residentPhone.trim() || formData.ownerPhone.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        });

        setFeedback({ type: 'success', message: `Apartment unit "${formData.unitNumber}" successfully created.` });
      } else {
        if (!selectedApartment) return;
        await api.patch(`/apartments/${selectedApartment.id}`, {
          unitNumber: formData.unitNumber.trim(),
          floor: Number(formData.floor),
          towerId: formData.towerId || null,
          areaSqft: Number(formData.areaSqft),
          roomCount: Number(formData.roomCount),
          status: formData.status,
          ownerName: formData.ownerName.trim() || null,
          ownerEmail: formData.ownerEmail.trim() || null,
          ownerPhone: formData.ownerPhone.trim() || null,
          residentName: formData.residentName.trim() || null,
          residentEmail: formData.residentEmail.trim() || null,
          residentPhone: formData.residentPhone.trim() || null,
          notes: formData.notes.trim() || null,
        });

        setFeedback({ type: 'success', message: `Apartment unit "${formData.unitNumber}" updated successfully.` });
      }

      setShowModal(false);
      setSelectedApartment(null);
      fetchApartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to save apartment unit';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Detailed Apartment Record
  const openViewModal = (apt: Apartment) => {
    setSelectedApartment(apt);
    setShowViewModal(true);
  };

  // Confirm Deactivate
  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/apartments/${deactivateTarget.id}`);
      setFeedback({ type: 'success', message: `Apartment unit "${deactivateTarget.unitNumber}" deactivated successfully.` });
      setDeactivateTarget(null);
      fetchApartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to deactivate apartment';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Tower
  const handleCreateTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id || !selectedBuildingId) return;
    if (!towerForm.name.trim()) {
      setModalError('Please enter a tower or block name');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/apartments/towers', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId,
        name: towerForm.name.trim(),
        code: towerForm.code.trim() || undefined,
        totalFloors: Number(towerForm.totalFloors) || undefined,
        description: towerForm.description.trim() || undefined,
      });

      setTowerForm({ name: '', code: '', totalFloors: 10, description: '' });
      fetchTowers();
      setFeedback({ type: 'success', message: `Tower "${towerForm.name}" created successfully.` });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to add tower';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available floor numbers
  const availableFloors = useMemo(() => {
    const floorsSet = new Set<number>();
    apartments.forEach((a) => {
      if (a.floor !== undefined && a.floor !== null) floorsSet.add(a.floor);
    });
    const selectedTower = towers.find((t) => t.id === selectedTowerId);
    if (selectedTower?.totalFloors) {
      for (let i = 1; i <= selectedTower.totalFloors; i++) {
        floorsSet.add(i);
      }
    }
    return Array.from(floorsSet).sort((a, b) => a - b);
  }, [apartments, towers, selectedTowerId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ─── PAGE HEADER & ACTIONS ───────────────────────────── */}
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
            Apartments Management
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Manage apartment units, room counts, area dimensions, and resident assignments
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={() => {
                setModalError(null);
                setShowTowersModal(true);
              }}
            >
              <BuildingIcon size={16} /> Manage Towers ({towers.length})
            </button>
            <button
              id="btn-add-apartment"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={openAddModal}
            >
              <Plus size={16} /> Add Apartment
            </button>
          </div>
        )}
      </div>

      {/* ─── TOAST / BANNER FEEDBACK ─────────────────────────── */}
      {feedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: feedback.type === 'success' ? 'hsl(142, 70%, 12%)' : 'hsl(0, 84%, 12%)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--color-success-500)' : 'var(--color-danger-500)'}`,
            color: feedback.type === 'success' ? 'var(--color-success-100)' : 'var(--color-danger-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} color="var(--color-success-500)" />
            ) : (
              <AlertCircle size={18} color="var(--color-danger-500)" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            className="btn-ghost"
            style={{ padding: '2px', color: 'inherit' }}
            onClick={() => setFeedback(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ─── BUILDING HIERARCHY SELECTOR RIBBON ──────────────── */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignItems: 'center',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Complex / Building */}
        <div style={{ minWidth: '200px', flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Complex / Building
          </label>
          <select
            className="input"
            value={selectedBuildingId}
            onChange={(e) => {
              setSelectedBuildingId(e.target.value);
              setSelectedTowerId('');
              setSelectedFloor('');
            }}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tower Selector */}
        <div style={{ minWidth: '180px', flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-400)', marginBottom: '4px', display: 'block' }}>
            Tower / Block
          </label>
          <select
            className="input"
            value={selectedTowerId}
            onChange={(e) => {
              setSelectedTowerId(e.target.value);
              setSelectedFloor('');
            }}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">All Towers ({towers.length})</option>
            {towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.code ? `(${t.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Floor Level */}
        <div style={{ minWidth: '140px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-400)', marginBottom: '4px', display: 'block' }}>
            Floor Level
          </label>
          <select
            className="input"
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">All Floors</option>
            {availableFloors.map((fl) => (
              <option key={fl} value={fl}>
                Floor {fl}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ minWidth: '140px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Status
          </label>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="VACANT">Vacant</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {/* Search Input */}
        <div style={{ flex: 2, minWidth: '220px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Search Unit or Resident
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
              placeholder="Search Unit (e.g. A-101), Resident..."
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

      {/* ─── APARTMENTS TABLE ─────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
            <p>Loading apartment units...</p>
          </div>
        ) : apartments.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Home size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No apartments found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Add apartments or adjust your filters to view and manage apartment units.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Unit No & Tower</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Floor</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Rooms</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Total Area (Sq.Ft.)</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Occupant</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Outstanding Arrears</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apartments.map((apt) => {
                  const arrearsNum = Number(apt.outstandingArrears ?? 0);
                  const displayRooms = apt.roomCount ?? (apt._count?.rooms || apt.rooms?.length || 1);

                  return (
                    <tr
                      key={apt.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Unit No & Tower */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Home size={16} color="var(--color-brand-400)" />
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
                              {apt.unitNumber}
                            </span>
                            {apt.tower && (
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '0.75rem',
                                  color: 'var(--color-brand-400)',
                                  fontWeight: 600,
                                }}
                              >
                                {apt.tower.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Floor */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                        Floor {apt.floor}
                      </td>

                      {/* Rooms Concept */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: 'var(--color-surface-2)',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <Layers size={13} color="var(--color-brand-400)" />
                          {displayRooms} {displayRooms === 1 ? 'Room' : 'Rooms'}
                        </span>
                      </td>

                      {/* Total Area */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>
                        {Number(apt.areaSqft).toLocaleString()} sq ft
                      </td>

                      {/* Occupant */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {apt.residentName || apt.ownerName || <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}
                        </div>
                        {apt.ownerPhone && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{apt.ownerPhone}</div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span
                          className={`badge ${
                            apt.status === 'OCCUPIED' || apt.status === 'ACTIVE'
                              ? 'badge-success'
                              : apt.status === 'VACANT'
                              ? 'badge-primary'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        >
                          {apt.status}
                        </span>
                      </td>

                      {/* Outstanding Arrears */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700 }}>
                        {arrearsNum > 0 ? (
                          <span style={{ color: 'var(--color-danger-500)' }}>
                            Rs. {arrearsNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-success-500)' }}>Rs. 0.00</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn-ghost"
                            title="View Unit Details"
                            onClick={() => openViewModal(apt)}
                            style={{ padding: '6px' }}
                          >
                            <Eye size={15} color="var(--color-text-secondary)" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                className="btn-ghost"
                                title="Edit Apartment"
                                onClick={() => openEditModal(apt)}
                                style={{ padding: '6px' }}
                              >
                                <Edit2 size={15} color="var(--color-text-secondary)" />
                              </button>
                              <button
                                className="btn-ghost"
                                title="Deactivate"
                                onClick={() => setDeactivateTarget(apt)}
                                style={{ padding: '6px' }}
                              >
                                <Trash2 size={15} color="var(--color-danger-500)" />
                              </button>
                            </>
                          )}
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

      {/* ─── UNIFIED MODERN ADD / EDIT APARTMENT MODAL ───────── */}
      {showModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '680px',
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
                paddingBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', margin: 0 }}>
                  {modalMode === 'add' ? 'Add New Apartment Unit' : `Edit Apartment ${formData.unitNumber}`}
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
                  {modalMode === 'add'
                    ? 'Fill in apartment specifications, room count, and resident details.'
                    : 'Update apartment unit information, area specs, and tenant assignment.'}
                </p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error in Modal */}
            {modalError && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  background: 'hsl(0, 84%, 12%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-danger-100)',
                  marginBottom: 'var(--space-4)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} color="var(--color-danger-500)" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveApartment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Complex & Tower Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Building / Complex *</label>
                  <select
                    className="input"
                    value={formData.buildingId}
                    onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })}
                    required
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Tower / Block</label>
                  <select
                    className="input"
                    value={formData.towerId}
                    onChange={(e) => setFormData({ ...formData, towerId: e.target.value })}
                  >
                    <option value="">No Specific Tower</option>
                    {towers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.code ? `(${t.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Unit Number, Floor, Area, Room Count, Status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Unit Number *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. A-101"
                    value={formData.unitNumber}
                    onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Floor Level *</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                    min={0}
                    required
                  />
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Area (Sq.Ft.) *</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="1000"
                    value={formData.areaSqft}
                    onChange={(e) => setFormData({ ...formData, areaSqft: Number(e.target.value) })}
                    min={1}
                    required
                  />
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Rooms Count *</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="2"
                    value={formData.roomCount}
                    onChange={(e) => setFormData({ ...formData, roomCount: Number(e.target.value) })}
                    min={1}
                    required
                  />
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Status *</label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="OCCUPIED">OCCUPIED</option>
                    <option value="VACANT">VACANT</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Owner Information Section */}
              <div
                style={{
                  background: 'var(--color-surface-2)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Property Owner Particulars
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Owner Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Mr. K. Perera"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Owner Phone</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="+94 77 123 4567"
                      value={formData.ownerPhone}
                      onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Owner Email</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="owner@example.com"
                      value={formData.ownerEmail}
                      onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Resident / Tenant Information Section */}
              <div
                style={{
                  background: 'var(--color-surface-2)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Current Resident / Tenant Particulars
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Resident Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Mr. K. Perera"
                      value={formData.residentName}
                      onChange={(e) => setFormData({ ...formData, residentName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Resident Phone</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="+94 77 987 6543"
                      value={formData.residentPhone}
                      onChange={(e) => setFormData({ ...formData, residentPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Resident Email</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="resident@example.com"
                      value={formData.residentEmail}
                      onChange={(e) => setFormData({ ...formData, residentEmail: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>Notes / Remarks (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Corner unit with balcony"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--space-3)',
                  marginTop: 'var(--space-3)',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'add' ? 'Save Apartment' : 'Update Apartment'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRMATION MODAL FOR DEACTIVATION ─────────────── */}
      {deactivateTarget && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '440px', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-3)' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'hsl(0, 84%, 15%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-danger-500)',
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Confirm Deactivation</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  Unit {deactivateTarget.unitNumber}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 'var(--space-2) 0 var(--space-5)' }}>
              Are you sure you want to deactivate apartment <strong>{deactivateTarget.unitNumber}</strong>? Existing billing records and financial history will remain preserved.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeactivateTarget(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--color-danger-500)', borderColor: 'var(--color-danger-500)' }}
                onClick={handleConfirmDeactivate}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deactivating...' : 'Yes, Deactivate Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MANAGE TOWERS / BLOCKS MODAL ────────────────────── */}
      {showTowersModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BuildingIcon size={20} color="var(--color-brand-400)" />
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                  Manage Towers / Blocks
                </h3>
              </div>
              <button className="btn-ghost" onClick={() => setShowTowersModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* List Existing Towers */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                Existing Towers for Selected Building
              </h4>
              {towers.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No towers configured yet. Single-building mode active.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--color-surface-2)' }}>
                      <tr>
                        <th style={{ padding: '8px 12px' }}>Tower Name</th>
                        <th style={{ padding: '8px 12px' }}>Code</th>
                        <th style={{ padding: '8px 12px' }}>Total Floors</th>
                        <th style={{ padding: '8px 12px' }}>Apartments</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {towers.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700 }}>{t.name}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-brand-400)' }}>{t.code || '-'}</td>
                          <td style={{ padding: '8px 12px' }}>{t.totalFloors ? `${t.totalFloors} Floors` : '-'}</td>
                          <td style={{ padding: '8px 12px' }}>{t._count?.apartments ?? 0} Units</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add Tower Form */}
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
                Add New Tower or Block
              </h4>
              <form onSubmit={handleCreateTower} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                  <div>
                    <label className="label">Tower / Block Name *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Tower A, West Block"
                      value={towerForm.name}
                      onChange={(e) => setTowerForm({ ...towerForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Short Code</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. T-A, BLK-1"
                      value={towerForm.code}
                      onChange={(e) => setTowerForm({ ...towerForm, code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                  <div>
                    <label className="label">Total Number of Floors</label>
                    <input
                      type="number"
                      className="input"
                      value={towerForm.totalFloors}
                      onChange={(e) => setTowerForm({ ...towerForm, totalFloors: Number(e.target.value) })}
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="label">Description / Remarks</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Sea View Wing"
                      value={towerForm.description}
                      onChange={(e) => setTowerForm({ ...towerForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating Tower...' : 'Add Tower'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── VIEW APARTMENT MODAL ────────────────────────────── */}
      {showViewModal && selectedApartment && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                  Apartment {selectedApartment.unitNumber}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {selectedApartment.building?.name || 'Building'} {selectedApartment.tower ? `· ${selectedApartment.tower.name} ` : ''}· Floor {selectedApartment.floor} · {Number(selectedApartment.areaSqft).toLocaleString()} Sq.Ft.
                </span>
              </div>
              <button className="btn-ghost" onClick={() => setShowViewModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-3" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Outstanding Arrears</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: Number(selectedApartment.outstandingArrears) > 0 ? 'var(--color-danger-500)' : 'var(--color-success-500)' }}>
                  Rs. {Number(selectedApartment.outstandingArrears ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Floor Area</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  {Number(selectedApartment.areaSqft).toLocaleString()} sq ft
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total Rooms</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-brand-400)' }}>
                  {selectedApartment.roomCount ?? (selectedApartment._count?.rooms || selectedApartment.rooms?.length || 1)}
                </div>
              </div>
            </div>

            {/* Occupant Particulars */}
            <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--color-surface-2)', marginBottom: 'var(--space-4)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Occupant Information
              </h4>
              <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Registered Owner</div>
                  <div style={{ fontWeight: 600 }}>{selectedApartment.ownerName || 'None assigned'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{selectedApartment.ownerPhone || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{selectedApartment.ownerEmail || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Resident / Tenant</div>
                  <div style={{ fontWeight: 600 }}>{selectedApartment.residentName || selectedApartment.ownerName || 'None'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{selectedApartment.residentPhone || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{selectedApartment.residentEmail || '-'}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              {canManage && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(selectedApartment);
                  }}
                >
                  Edit Apartment
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
