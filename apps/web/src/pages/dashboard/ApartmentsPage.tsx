import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Search,
  AlertCircle,
  Loader2,
  Home,
  Eye,
  Edit2,
  Trash2,
  X,
  Layers,
  Building as BuildingIcon,
  Calculator,
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

interface ApartmentRoom {
  id: string;
  roomNumber: string;
  roomType: 'BEDROOM' | 'LIVING_ROOM' | 'KITCHEN' | 'BATHROOM' | 'BALCONY' | 'STORAGE' | 'OTHER';
  areaSqft: number | string;
  maintenanceRate?: number | string | null;
  applicableRate?: number | string;
  monthlyCharge?: number | string;
  isActive: boolean;
  notes?: string | null;
}

interface Apartment {
  id: string;
  unitNumber: string;
  floor: number;
  areaSqft: number | string;
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
  rooms?: ApartmentRoom[];
  _count?: { rooms: number };
  building?: { id: string; name: string; address: string };
  outstandingArrears?: number | string;
}

interface Building {
  id: string;
  name: string;
}

const ROOM_TYPES = [
  { value: 'BEDROOM', label: 'Bedroom' },
  { value: 'LIVING_ROOM', label: 'Living Room' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'BATHROOM', label: 'Bathroom' },
  { value: 'BALCONY', label: 'Balcony' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'OTHER', label: 'Other Room' },
];

export default function ApartmentsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const navigate = useNavigate();

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

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRoomsModal, setShowRoomsModal] = useState(false);
  const [showTowersModal, setShowTowersModal] = useState(false);

  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [apartmentDetails, setApartmentDetails] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Rooms Management State
  const [roomsData, setRoomsData] = useState<{
    apartmentId: string;
    unitNumber: string;
    defaultRate: number;
    rooms: ApartmentRoom[];
    totalArea: number;
    totalCharge: number;
  } | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ApartmentRoom | null>(null);

  // New Room Form
  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    roomType: 'BEDROOM' as ApartmentRoom['roomType'],
    areaSqft: 150,
    maintenanceRate: '', // empty means inherit apartment default
    notes: '',
  });

  // New Tower Form
  const [towerForm, setTowerForm] = useState({
    name: '',
    code: '',
    totalFloors: 10,
    description: '',
  });

  // Apartment Add/Edit Form State
  const [formData, setFormData] = useState({
    unitNumber: '',
    floor: 1,
    towerId: '',
    areaSqft: 1000,
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

  // Load Rooms for a selected apartment
  const loadApartmentRooms = async (aptId: string) => {
    setIsLoadingRooms(true);
    try {
      const { data } = await api.get(`/apartments/${aptId}/rooms`);
      setRoomsData(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load apartment rooms';
      setModalError(msg);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const openRoomsModal = (apt: Apartment) => {
    setSelectedApartment(apt);
    setEditingRoom(null);
    setRoomForm({
      roomNumber: '',
      roomType: 'BEDROOM',
      areaSqft: 150,
      maintenanceRate: '',
      notes: '',
    });
    setModalError(null);
    setShowRoomsModal(true);
    loadApartmentRooms(apt.id);
  };

  // Immediate Live Room Calculation for Add/Edit
  const previewAddCharge = useMemo(() => {
    const area = Number(roomForm.areaSqft) || 0;
    const defaultRate = Number(roomsData?.defaultRate ?? 10);
    const rate = roomForm.maintenanceRate !== '' ? Number(roomForm.maintenanceRate) : defaultRate;
    return area * rate;
  }, [roomForm.areaSqft, roomForm.maintenanceRate, roomsData?.defaultRate]);

  // Add Room
  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment || !activeOrg?.id) return;
    if (!roomForm.roomNumber.trim() || Number(roomForm.areaSqft) <= 0) {
      setModalError('Please enter a valid room name and positive area in square feet');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/apartments/rooms', {
        organizationId: activeOrg.id,
        buildingId: selectedApartment.buildingId,
        apartmentId: selectedApartment.id,
        roomNumber: roomForm.roomNumber.trim(),
        roomType: roomForm.roomType,
        areaSqft: Number(roomForm.areaSqft),
        maintenanceRate: roomForm.maintenanceRate !== '' ? Number(roomForm.maintenanceRate) : undefined,
        notes: roomForm.notes || undefined,
      });

      setRoomForm({
        roomNumber: '',
        roomType: 'BEDROOM',
        areaSqft: 120,
        maintenanceRate: '',
        notes: '',
      });

      await loadApartmentRooms(selectedApartment.id);
      fetchApartments(); // Sync apartment total area in main table
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to add room';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Room
  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !selectedApartment) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.patch(`/apartments/rooms/${editingRoom.id}`, {
        roomNumber: editingRoom.roomNumber.trim(),
        roomType: editingRoom.roomType,
        areaSqft: Number(editingRoom.areaSqft),
        maintenanceRate:
          editingRoom.maintenanceRate !== '' && editingRoom.maintenanceRate !== null
            ? Number(editingRoom.maintenanceRate)
            : null,
        isActive: editingRoom.isActive,
        notes: editingRoom.notes || null,
      });

      setEditingRoom(null);
      await loadApartmentRooms(selectedApartment.id);
      fetchApartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update room';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Room
  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!window.confirm(`Are you sure you want to deactivate room "${roomName}"? Existing bill snapshots will remain preserved.`)) {
      return;
    }
    if (!selectedApartment) return;

    try {
      await api.delete(`/apartments/rooms/${roomId}`);
      await loadApartmentRooms(selectedApartment.id);
      fetchApartments();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to deactivate room',
      );
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
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to add tower';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Create Apartment
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id) return;
    if (!formData.unitNumber || !formData.areaSqft) {
      setModalError('Please enter Apartment Number and Floor Area');
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
      await api.post('/apartments', {
        organizationId: activeOrg.id,
        buildingId: bldgId,
        towerId: formData.towerId || undefined,
        unitNumber: formData.unitNumber,
        floor: Number(formData.floor),
        areaSqft: Number(formData.areaSqft),
        status: formData.status,
        ownerName: formData.ownerName || undefined,
        ownerEmail: formData.ownerEmail || undefined,
        ownerPhone: formData.ownerPhone || undefined,
        residentName: formData.residentName || formData.ownerName || undefined,
        residentEmail: formData.residentEmail || formData.ownerEmail || undefined,
        residentPhone: formData.residentPhone || formData.ownerPhone || undefined,
        notes: formData.notes || undefined,
      });

      setShowAddModal(false);
      resetForm();
      fetchApartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create apartment';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Apartment
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.patch(`/apartments/${selectedApartment.id}`, {
        unitNumber: formData.unitNumber,
        floor: Number(formData.floor),
        towerId: formData.towerId || null,
        areaSqft: Number(formData.areaSqft),
        status: formData.status,
        ownerName: formData.ownerName || null,
        ownerEmail: formData.ownerEmail || null,
        ownerPhone: formData.ownerPhone || null,
        residentName: formData.residentName || null,
        residentEmail: formData.residentEmail || null,
        residentPhone: formData.residentPhone || null,
        notes: formData.notes || null,
      });

      setShowEditModal(false);
      setSelectedApartment(null);
      resetForm();
      fetchApartments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update apartment';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (apt: Apartment) => {
    setSelectedApartment(apt);
    setFormData({
      unitNumber: apt.unitNumber,
      floor: apt.floor,
      towerId: apt.towerId || '',
      areaSqft: Number(apt.areaSqft),
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
    setShowEditModal(true);
  };

  // View Detailed Apartment Record
  const openViewModal = async (apt: Apartment) => {
    setSelectedApartment(apt);
    setShowViewModal(true);
    setApartmentDetails(null);
    try {
      const { data } = await api.get(`/apartments/${apt.id}`);
      setApartmentDetails(data);
    } catch {
      setApartmentDetails(apt);
    }
  };

  // Deactivate Apartment
  const handleDeactivate = async (apt: Apartment) => {
    if (!window.confirm(`Are you sure you want to deactivate Apartment ${apt.unitNumber}?`)) {
      return;
    }
    try {
      await api.delete(`/apartments/${apt.id}`);
      fetchApartments();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to deactivate apartment',
      );
    }
  };

  const resetForm = () => {
    setFormData({
      unitNumber: '',
      floor: 1,
      towerId: selectedTowerId,
      areaSqft: 1000,
      status: 'ACTIVE',
      buildingId: selectedBuildingId,
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '',
      residentName: '',
      residentEmail: '',
      residentPhone: '',
      notes: '',
    });
    setModalError(null);
  };

  // Extract available floor numbers from current apartments or tower
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
            Building Structure & Apartments
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Apartment Complex → Tower/Block → Floor → Apartment/Unit → Individual Rooms
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
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              <Plus size={16} /> Add Apartment
            </button>
          </div>
        )}
      </div>

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
        {/* 1. Building Selector */}
        <div style={{ minWidth: '200px', flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            1. Complex / Building
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

        {/* 2. Tower Selector */}
        <div style={{ minWidth: '180px', flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-400)', marginBottom: '4px', display: 'block' }}>
            2. Tower / Block
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

        {/* 3. Floor Selector */}
        <div style={{ minWidth: '140px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-400)', marginBottom: '4px', display: 'block' }}>
            3. Floor Level
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
            Search Apartment or Owner
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
            <p>Loading apartment units and room data...</p>
          </div>
        ) : apartments.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Home size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No apartments found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Add apartments or configure towers to start managing individual rooms and monthly maintenance bills.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Unit No & Tower</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Floor</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Configured Rooms</th>
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
                  const roomCount = apt._count?.rooms ?? (apt.rooms?.length || 0);

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

                      {/* Configured Rooms Action Button */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <button
                          className={`btn ${roomCount > 0 ? 'btn-outline' : 'btn-ghost'}`}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderRadius: 'var(--radius-full)',
                            borderColor: roomCount > 0 ? 'var(--color-brand-500)' : 'var(--color-border)',
                          }}
                          onClick={() => openRoomsModal(apt)}
                          title="Manage individual rooms and floor area"
                        >
                          <Layers size={14} color={roomCount > 0 ? 'var(--color-brand-400)' : 'var(--color-text-muted)'} />
                          <span style={{ fontWeight: 600 }}>
                            {roomCount > 0 ? `${roomCount} Rooms` : '+ Add Rooms'}
                          </span>
                        </button>
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
                            title="Open Rooms & Maintenance Breakdown"
                            onClick={() => openRoomsModal(apt)}
                            style={{ padding: '6px' }}
                          >
                            <Layers size={15} color="var(--color-brand-400)" />
                          </button>
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
                                title="Edit Unit"
                                onClick={() => openEditModal(apt)}
                                style={{ padding: '6px' }}
                              >
                                <Edit2 size={15} color="var(--color-text-secondary)" />
                              </button>
                              <button
                                className="btn-ghost"
                                title="Deactivate"
                                onClick={() => handleDeactivate(apt)}
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

      {/* ─── 4. INDIVIDUAL ROOMS MANAGEMENT MODAL ───────────── */}
      {showRoomsModal && selectedApartment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Layers size={18} color="var(--color-brand-400)" />
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                    Apartment {selectedApartment.unitNumber} — Individual Rooms
                  </h3>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {selectedApartment.building?.name || 'Condominium'} · {selectedApartment.tower ? `${selectedApartment.tower.name} · ` : ''}Floor {selectedApartment.floor}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => {
                    setShowRoomsModal(false);
                    navigate('/dashboard/billing');
                  }}
                  title="Generate monthly bill with room breakdown"
                >
                  <Calculator size={14} /> Generate Bill
                </button>
                <button className="btn-ghost" onClick={() => setShowRoomsModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

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
                }}
              >
                {modalError}
              </div>
            )}

            {/* Live Calculation KPI Summary Ribbon */}
            <div
              className="grid grid-4"
              style={{
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Configured Rooms</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {roomsData?.rooms?.length || 0}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total Apartment Area</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-brand-400)' }}>
                  {Number(roomsData?.totalArea ?? selectedApartment.areaSqft).toLocaleString()} sq. ft.
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Base Maintenance Rate</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  Rs. {Number(roomsData?.defaultRate ?? 10).toFixed(2)}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-3)', background: 'hsl(142, 70%, 10%)', border: '1px solid var(--color-success-500)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-success-100)' }}>Combined Monthly Charge</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success-400)' }}>
                  Rs. {Number(roomsData?.totalCharge ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Rooms Breakdown Table */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                Room Schedule & Maintenance Charges
              </h4>

              {isLoadingRooms ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                </div>
              ) : !roomsData?.rooms || roomsData.rooms.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    background: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <p style={{ fontWeight: 600 }}>No individual rooms configured yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    This apartment currently bills using its default flat area ({selectedApartment.areaSqft} sq ft). Add rooms below to calculate room-level charges.
                  </p>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                      <tr>
                        <th style={{ padding: '8px 12px' }}>Room Name / No</th>
                        <th style={{ padding: '8px 12px' }}>Type</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Area (Sq.Ft.)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate / Sq.Ft.</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Monthly Charge</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomsData.rooms.map((r) => {
                        const isCustomRate = r.maintenanceRate !== null && r.maintenanceRate !== undefined;
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', opacity: r.isActive ? 1 : 0.6 }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.roomNumber}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                className="badge badge-primary"
                                style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
                              >
                                {r.roomType.replace('_', ' ').toLowerCase()}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {Number(r.areaSqft).toLocaleString()} sq. ft.
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              Rs. {Number(r.applicableRate).toFixed(2)}
                              {isCustomRate && (
                                <span style={{ fontSize: '0.65rem', marginLeft: '4px', color: 'var(--color-brand-400)', fontWeight: 600 }}>
                                  (Custom)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-brand-400)' }}>
                              Rs. {Number(r.monthlyCharge).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span
                                className={`badge ${r.isActive ? 'badge-success' : 'badge-warning'}`}
                                style={{ fontSize: '0.65rem' }}
                              >
                                {r.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  className="btn-ghost"
                                  title="Edit Room"
                                  onClick={() => setEditingRoom(r)}
                                  style={{ padding: '4px' }}
                                >
                                  <Edit2 size={13} color="var(--color-text-secondary)" />
                                </button>
                                <button
                                  className="btn-ghost"
                                  title="Deactivate Room"
                                  onClick={() => handleDeleteRoom(r.id, r.roomNumber)}
                                  style={{ padding: '4px' }}
                                >
                                  <Trash2 size={13} color="var(--color-danger-500)" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr style={{ background: 'var(--color-surface-2)', fontWeight: 800 }}>
                        <td colSpan={2} style={{ padding: '10px 12px', textTransform: 'uppercase' }}>
                          Total ({roomsData.rooms.filter((r) => r.isActive).length} Active Rooms)
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-brand-400)' }}>
                          {Number(roomsData.totalArea).toLocaleString()} sq. ft.
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-success-400)', fontSize: '0.95rem' }}>
                          Rs. {Number(roomsData.totalCharge).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Edit Room In-Line Form */}
            {editingRoom && (
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-brand-500)',
                  marginBottom: 'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase' }}>
                    Edit Room: {editingRoom.roomNumber}
                  </h4>
                  <button className="btn-ghost" onClick={() => setEditingRoom(null)}>
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleUpdateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
                    <div>
                      <label className="label">Room Name / No *</label>
                      <input
                        type="text"
                        className="input"
                        value={editingRoom.roomNumber}
                        onChange={(e) => setEditingRoom({ ...editingRoom, roomNumber: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="label">Room Type *</label>
                      <select
                        className="input"
                        value={editingRoom.roomType}
                        onChange={(e) => setEditingRoom({ ...editingRoom, roomType: e.target.value as any })}
                      >
                        {ROOM_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Area (Sq.Ft.) *</label>
                      <input
                        type="number"
                        className="input"
                        value={editingRoom.areaSqft}
                        onChange={(e) => setEditingRoom({ ...editingRoom, areaSqft: Number(e.target.value) })}
                        min={1}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                    <div>
                      <label className="label">Maintenance Rate (Rs./Sq.Ft.)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        placeholder={`Leave blank to use default (Rs. ${Number(roomsData?.defaultRate ?? 10).toFixed(2)})`}
                        value={editingRoom.maintenanceRate ?? ''}
                        onChange={(e) => setEditingRoom({ ...editingRoom, maintenanceRate: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                      <input
                        type="checkbox"
                        id="editRoomActive"
                        checked={editingRoom.isActive}
                        onChange={(e) => setEditingRoom({ ...editingRoom, isActive: e.target.checked })}
                      />
                      <label htmlFor="editRoomActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                        Room is Active (Included in monthly billing)
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingRoom(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Updating...' : 'Save Room'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ─── ADD ROOM FORM WITH LIVE CALCULATION ─────────── */}
            <div
              style={{
                padding: 'var(--space-4)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
                Add New Room to Apartment {selectedApartment.unitNumber}
              </h4>

              <form onSubmit={handleAddRoom} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
                  <div>
                    <label className="label">Room Name or Number *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Bedroom 1, Master Bed, Living Room"
                      value={roomForm.roomNumber}
                      onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Room Type *</label>
                    <select
                      className="input"
                      value={roomForm.roomType}
                      onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value as any })}
                    >
                      {ROOM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Area in Square Feet (Sq.Ft.) *</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 150"
                      value={roomForm.areaSqft}
                      onChange={(e) => setRoomForm({ ...roomForm, areaSqft: Number(e.target.value) })}
                      min={1}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                  <div>
                    <label className="label">Applicable Rate (Rs. / Sq.Ft.)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder={`Default: Rs. ${Number(roomsData?.defaultRate ?? 10).toFixed(2)} / sq ft`}
                      value={roomForm.maintenanceRate}
                      onChange={(e) => setRoomForm({ ...roomForm, maintenanceRate: e.target.value })}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Leave blank to use apartment complex base rate.
                    </span>
                  </div>

                  {/* Immediate Live Calculation Preview Box */}
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      background: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--color-brand-500)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-brand-400)', fontWeight: 600 }}>
                      ⚡ Immediate Calculated Monthly Charge:
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                      {Number(roomForm.areaSqft || 0)} sq ft × Rs.{' '}
                      {Number(roomForm.maintenanceRate !== '' ? roomForm.maintenanceRate : roomsData?.defaultRate ?? 10).toFixed(2)} ={' '}
                      <span style={{ color: 'var(--color-success-400)' }}>
                        Rs. {previewAddCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || !roomForm.roomNumber.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> {isSubmitting ? 'Adding...' : 'Add Room to Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. MANAGE TOWERS / BLOCKS MODAL ────────────────── */}
      {showTowersModal && (
        <div className="modal-backdrop">
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

      {/* ─── ADD APARTMENT MODAL ─────────────────────────────── */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Add New Apartment Unit</h3>
              <button className="btn-ghost" onClick={() => setShowAddModal(false)}>
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
                  marginBottom: 'var(--space-4)',
                  fontSize: '0.85rem',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Building / Complex *</label>
                  <select
                    className="input"
                    value={formData.buildingId || selectedBuildingId}
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
                  <label className="label">Tower / Block</label>
                  <select
                    className="input"
                    value={formData.towerId}
                    onChange={(e) => setFormData({ ...formData, towerId: e.target.value })}
                  >
                    <option value="">No Specific Tower</option>
                    {towers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Apartment / Unit No *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. A-101, 6/3"
                    value={formData.unitNumber}
                    onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Floor Level</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                    min={0}
                  />
                </div>

                <div>
                  <label className="label">Area (Sq.Ft.) *</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 1000"
                    value={formData.areaSqft}
                    onChange={(e) => setFormData({ ...formData, areaSqft: Number(e.target.value) })}
                    required
                    min={1}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase' }}>
                  Owner Particulars
                </span>
                <div className="grid grid-3" style={{ gap: 'var(--space-3)', marginTop: '8px' }}>
                  <div>
                    <label className="label">Owner Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Mr. R. Wickramasinghe"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Owner Phone</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="+94 77 123 4567"
                      value={formData.ownerPhone}
                      onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Owner Email</label>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Add Apartment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT APARTMENT MODAL ────────────────────────────── */}
      {showEditModal && selectedApartment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Edit Apartment {selectedApartment.unitNumber}
              </h3>
              <button className="btn-ghost" onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Tower / Block</label>
                  <select
                    className="input"
                    value={formData.towerId}
                    onChange={(e) => setFormData({ ...formData, towerId: e.target.value })}
                  >
                    <option value="">No Specific Tower</option>
                    {towers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Apartment / Unit No *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.unitNumber}
                    onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Floor Level</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                    min={0}
                  />
                </div>

                <div>
                  <label className="label">Area (Sq.Ft.) *</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.areaSqft}
                    onChange={(e) => setFormData({ ...formData, areaSqft: Number(e.target.value) })}
                    required
                    min={1}
                  />
                </div>

                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="OCCUPIED">Occupied</option>
                    <option value="VACANT">Vacant</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase' }}>
                  Owner Particulars
                </span>
                <div className="grid grid-3" style={{ gap: 'var(--space-3)', marginTop: '8px' }}>
                  <div>
                    <label className="label">Owner Name</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Owner Phone</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.ownerPhone}
                      onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Owner Email</label>
                    <input
                      type="email"
                      className="input"
                      value={formData.ownerEmail}
                      onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── VIEW APARTMENT MODAL ────────────────────────────── */}
      {showViewModal && selectedApartment && (
        <div className="modal-backdrop">
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
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Configured Rooms</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-brand-400)' }}>
                  {apartmentDetails?.rooms?.length ?? (selectedApartment.rooms?.length || 0)}
                </div>
              </div>
            </div>

            {/* Rooms Schedule in View Modal */}
            {apartmentDetails?.rooms && apartmentDetails.rooms.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase' }}>
                    Configured Individual Rooms
                  </h4>
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={() => {
                      setShowViewModal(false);
                      openRoomsModal(selectedApartment);
                    }}
                  >
                    Edit Rooms
                  </button>
                </div>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--color-surface-2)' }}>
                      <tr>
                        <th style={{ padding: '6px 12px' }}>Room</th>
                        <th style={{ padding: '6px 12px' }}>Type</th>
                        <th style={{ padding: '6px 12px', textAlign: 'right' }}>Area (Sq.Ft.)</th>
                        <th style={{ padding: '6px 12px', textAlign: 'right' }}>Rate / Sq.Ft.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apartmentDetails.rooms.map((rm: any) => (
                        <tr key={rm.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>{rm.roomNumber}</td>
                          <td style={{ padding: '6px 12px' }}>{rm.roomType.replace('_', ' ').toLowerCase()}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>{Number(rm.areaSqft)} sq ft</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                            {rm.maintenanceRate ? `Rs. ${Number(rm.maintenanceRate).toFixed(2)}` : 'Building Default'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
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
