import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Grid,
  List,
  Search,
  Plus,
  RefreshCw,
  Home,
  CheckCircle2,
  UserCheck,
  Wrench,
  Ban,
  Building as BuildingIcon,
  Layers,
  X,
  Edit2,
  Trash2,
  UserPlus,
  UserX,
  CreditCard,
  AlertCircle,
  Loader2,
  Maximize2,
  DoorOpen,
  Bed,
  Utensils,
  Bath,
  Sun,
  Archive,
} from 'lucide-react';

interface Tower {
  id: string;
  name: string;
  code?: string | null;
  totalFloors?: number | null;
  _count?: { apartments: number };
}

interface Building {
  id: string;
  name: string;
  address: string;
  towers?: Tower[];
}

interface Room {
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
  status: string;
  computedStatus: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
  areaSqft: number | string;
  effectiveAreaSqft: number | string;
  roomsCount: number;
  residentName?: string | null;
  residentEmail?: string | null;
  residentPhone?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  outstandingArrears: number | string;
  notes?: string | null;
  isActive: boolean;
  buildingId: string;
  towerId?: string | null;
  rooms?: Room[];
}

interface BuildingLayoutData {
  building: {
    id: string;
    name: string;
    address: string;
  };
  towers: Tower[];
  selectedTowerId: string | null;
  availableFloors: number[];
  activeFloor: number;
  summary: {
    totalApartments: number;
    availableCount: number;
    occupiedCount: number;
    maintenanceCount: number;
    inactiveCount: number;
  };
  apartments: Apartment[];
  defaultRate: number | string;
}

const ROOM_TYPES = [
  { value: 'BEDROOM', label: 'Bedroom', icon: Bed },
  { value: 'LIVING_ROOM', label: 'Living Room', icon: Home },
  { value: 'KITCHEN', label: 'Kitchen', icon: Utensils },
  { value: 'BATHROOM', label: 'Bathroom', icon: Bath },
  { value: 'BALCONY', label: 'Balcony', icon: Sun },
  { value: 'STORAGE', label: 'Storage', icon: Archive },
  { value: 'OTHER', label: 'Other', icon: DoorOpen },
];

export default function BuildingLayoutPage() {
  const { activeOrg, hasPermission } = useAuth();
  const canManage = hasPermission('apartments.manage');
  const [searchParams] = useSearchParams();
  const urlBuildingId = searchParams.get('buildingId');

  // Main Layout State
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(urlBuildingId || '');
  const [selectedTowerId, setSelectedTowerId] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [layoutData, setLayoutData] = useState<BuildingLayoutData | null>(null);

  // View & Filter State
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer / Details Modal State
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [detailedApartment, setDetailedApartment] = useState<any | null>(null);

  // Action Modals State
  const [showAddAptModal, setShowAddAptModal] = useState(false);
  const [showEditAptModal, setShowEditAptModal] = useState(false);
  const [showAssignRenterModal, setShowAssignRenterModal] = useState(false);
  const [showEndTenancyModal, setShowEndTenancyModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states
  const [aptForm, setAptForm] = useState({
    unitNumber: '',
    floor: 1,
    towerId: '',
    areaSqft: 900,
    roomCount: 2,
    status: 'VACANT',
    notes: '',
  });

  const [roomCountInput, setRoomCountInput] = useState<number>(1);
  const [roomUpdateSuccess, setRoomUpdateSuccess] = useState<string | null>(null);

  const [renterForm, setRenterForm] = useState({
    residentName: '',
    residentEmail: '',
    residentPhone: '',
    notes: '',
  });

  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    roomType: 'BEDROOM' as Room['roomType'],
    areaSqft: 150,
    maintenanceRate: '',
    notes: '',
  });

  // 1. Fetch authorized buildings for selector
  const fetchBuildings = useCallback(async () => {
    try {
      const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
      const { data } = await api.get(url);
      setBuildings(data);
      if (data.length > 0) {
        if (urlBuildingId && data.some((b: Building) => b.id === urlBuildingId)) {
          setSelectedBuildingId(urlBuildingId);
        } else if (!selectedBuildingId) {
          setSelectedBuildingId(data[0].id);
        }
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch buildings';
      setError(msg);
    }
  }, [activeOrg, selectedBuildingId, urlBuildingId]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  // 2. Fetch Cinema Seat Building Layout
  const fetchLayout = useCallback(async () => {
    if (!selectedBuildingId) return;
    setIsLoading(true);
    setError(null);
    try {
      let url = `/apartments/building-layout/${selectedBuildingId}?`;
      if (selectedTowerId) url += `towerId=${selectedTowerId}&`;
      if (selectedFloor !== undefined) url += `floor=${selectedFloor}&`;

      const { data } = await api.get(url);
      setLayoutData(data);

      // Auto-sync tower and floor if not yet set
      if (!selectedTowerId && data.selectedTowerId) {
        setSelectedTowerId(data.selectedTowerId);
      }
      if (data.activeFloor && data.activeFloor !== selectedFloor) {
        setSelectedFloor(data.activeFloor);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load visual building layout';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBuildingId, selectedTowerId, selectedFloor]);

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  // 3. Fetch detailed apartment when selected
  const fetchApartmentDetails = useCallback(async (aptId: string) => {
    try {
      const { data } = await api.get(`/apartments/${aptId}`);
      setDetailedApartment(data);
    } catch (err: unknown) {
      console.error('Failed to load apartment details', err);
    }
  }, []);

  const handleSelectApartment = (apt: Apartment) => {
    setSelectedApartment(apt);
    setRoomCountInput(apt.roomsCount || 1);
    setRoomUpdateSuccess(null);
    fetchApartmentDetails(apt.id);
  };

  const handleSaveRoomCount = async () => {
    if (!selectedApartment || roomCountInput < 1) return;
    setIsSubmitting(true);
    setActionError(null);
    setRoomUpdateSuccess(null);
    try {
      await api.patch(`/apartments/${selectedApartment.id}`, {
        roomCount: Number(roomCountInput),
      });
      setSelectedApartment((prev) => (prev ? { ...prev, roomsCount: Number(roomCountInput) } : null));
      setDetailedApartment((prev: any) => (prev ? { ...prev, roomsCount: Number(roomCountInput) } : null));
      setRoomUpdateSuccess(`Room count updated to ${roomCountInput} rooms.`);
      fetchLayout();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to update room count';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Filter apartments for display
  const displayedApartments = useMemo(() => {
    if (!layoutData?.apartments) return [];
    let list = layoutData.apartments;

    if (statusFilter !== 'ALL') {
      list = list.filter((apt) => apt.computedStatus === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (apt) =>
          apt.unitNumber.toLowerCase().includes(q) ||
          apt.residentName?.toLowerCase().includes(q) ||
          apt.ownerName?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [layoutData?.apartments, statusFilter, searchQuery]);

  // 5. Actions: Add Apartment
  const handleCreateApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aptForm.unitNumber || !selectedBuildingId) {
      setActionError('Unit number is required');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await api.post('/apartments', {
        organizationId: activeOrg?.id,
        buildingId: selectedBuildingId,
        towerId: selectedTowerId || null,
        unitNumber: aptForm.unitNumber.trim(),
        floor: selectedFloor,
        areaSqft: Number(aptForm.areaSqft),
        roomCount: Number(aptForm.roomCount) || 1,
        status: aptForm.status,
        notes: aptForm.notes || null,
      });

      setShowAddAptModal(false);
      setAptForm({
        unitNumber: '',
        floor: selectedFloor,
        towerId: selectedTowerId,
        areaSqft: 900,
        roomCount: 2,
        status: 'VACANT',
        notes: '',
      });
      fetchLayout();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to create apartment';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Actions: Edit Apartment
  const handleUpdateApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment) return;

    setIsSubmitting(true);
    setActionError(null);
    try {
      const { data } = await api.patch(`/apartments/${selectedApartment.id}`, {
        unitNumber: aptForm.unitNumber.trim(),
        floor: aptForm.floor,
        towerId: aptForm.towerId || null,
        areaSqft: Number(aptForm.areaSqft),
        roomCount: Number(aptForm.roomCount) || 1,
        status: aptForm.status,
        notes: aptForm.notes || null,
      });

      setShowEditAptModal(false);
      setSelectedApartment(data);
      setRoomCountInput(data.roomsCount || Number(aptForm.roomCount) || 1);
      fetchApartmentDetails(selectedApartment.id);
      fetchLayout();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to update apartment';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Actions: Assign Renter
  const handleAssignRenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment || !renterForm.residentName) {
      setActionError('Resident name is required');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const { data } = await api.post(`/apartments/${selectedApartment.id}/assign-renter`, {
        residentName: renterForm.residentName.trim(),
        residentEmail: renterForm.residentEmail.trim() || undefined,
        residentPhone: renterForm.residentPhone.trim() || undefined,
        notes: renterForm.notes.trim() || undefined,
      });

      setShowAssignRenterModal(false);
      setRenterForm({ residentName: '', residentEmail: '', residentPhone: '', notes: '' });
      setSelectedApartment(data);
      fetchApartmentDetails(selectedApartment.id);
      fetchLayout();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to assign renter';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8. Actions: End Tenancy
  const handleEndTenancy = async () => {
    if (!selectedApartment) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const { data } = await api.post(`/apartments/${selectedApartment.id}/end-tenancy`, {});
      setShowEndTenancyModal(false);
      setSelectedApartment(data);
      fetchApartmentDetails(selectedApartment.id);
      fetchLayout();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to end tenancy';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 9. Actions: Add Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment || !roomForm.roomNumber) {
      setActionError('Room number/name is required');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await api.post('/apartments/rooms', {
        organizationId: activeOrg?.id,
        buildingId: selectedBuildingId,
        apartmentId: selectedApartment.id,
        roomNumber: roomForm.roomNumber.trim(),
        roomType: roomForm.roomType,
        areaSqft: Number(roomForm.areaSqft),
        maintenanceRate: roomForm.maintenanceRate !== '' ? Number(roomForm.maintenanceRate) : undefined,
        notes: roomForm.notes || undefined,
      });

      setShowAddRoomModal(false);
      setRoomForm({
        roomNumber: '',
        roomType: 'BEDROOM',
        areaSqft: 150,
        maintenanceRate: '',
        notes: '',
      });
      fetchApartmentDetails(selectedApartment.id);
      fetchLayout();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to add room';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 10. Actions: Update / Deactivate Room
  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !selectedApartment) return;

    setIsSubmitting(true);
    setActionError(null);
    try {
      await api.patch(`/apartments/rooms/${editingRoom.id}`, {
        roomNumber: editingRoom.roomNumber.trim(),
        roomType: editingRoom.roomType,
        areaSqft: Number(editingRoom.areaSqft),
        maintenanceRate: editingRoom.maintenanceRate !== '' && editingRoom.maintenanceRate !== null
          ? Number(editingRoom.maintenanceRate)
          : null,
        isActive: editingRoom.isActive,
        notes: editingRoom.notes || null,
      });

      setEditingRoom(null);
      fetchApartmentDetails(selectedApartment.id);
      fetchLayout();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ||
        'Failed to update room';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!selectedApartment) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/apartments/rooms/${roomId}`);
      setEditingRoom(null);
      fetchApartmentDetails(selectedApartment.id);
      fetchLayout();
    } catch (err: unknown) {
      console.error('Failed to deactivate room', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Styling Helper
  const getStatusBadge = (status: Apartment['computedStatus']) => {
    switch (status) {
      case 'VACANT':
        return {
          label: 'Available / Vacant',
          color: 'var(--color-success-500)',
          badgeClass: 'badge-success',
          cardClass: 'cinema-apt-card--vacant',
          icon: CheckCircle2,
        };
      case 'OCCUPIED':
        return {
          label: 'Occupied',
          color: '#3b82f6',
          badgeClass: 'badge-primary',
          cardClass: 'cinema-apt-card--occupied',
          icon: UserCheck,
        };
      case 'MAINTENANCE':
        return {
          label: 'Maintenance / Reserved',
          color: 'var(--color-warning-500)',
          badgeClass: 'badge-warning',
          cardClass: 'cinema-apt-card--maintenance',
          icon: Wrench,
        };
      case 'INACTIVE':
      default:
        return {
          label: 'Inactive / Unavailable',
          color: 'var(--color-text-muted)',
          badgeClass: 'badge',
          cardClass: 'cinema-apt-card--inactive',
          icon: Ban,
        };
    }
  };

  return (
    <div className="cinema-layout-container" style={{ paddingBottom: 'var(--space-12)' }}>
      {/* ── Top Header & Hierarchy Selectors ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="badge badge-primary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Availability Map
              </span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                Building Layout
              </h2>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: 'var(--space-1)' }}>
              Cinema seat-booking style interactive availability layout across building blocks and floors
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={fetchLayout}
              disabled={isLoading}
              title="Refresh availability layout"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {canManage && (
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  setAptForm({
                    unitNumber: '',
                    floor: selectedFloor,
                    towerId: selectedTowerId,
                    areaSqft: 900,
                    roomCount: 2,
                    status: 'VACANT',
                    notes: '',
                  });
                  setActionError(null);
                  setShowAddAptModal(true);
                }}
              >
                <Plus size={16} />
                <span>Add Apartment</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Hierarchy Selectors: Building → Tower/Block → Floor ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          {/* 1. Building Selector */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <BuildingIcon size={14} color="var(--color-brand-400)" />
              <strong>1. Building</strong>
            </label>
            <select
              className="input"
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                setSelectedTowerId('');
                setSelectedFloor(1);
              }}
              style={{ background: 'var(--color-surface-2)', fontWeight: 600 }}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Tower / Block Selector */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <Layers size={14} color="var(--color-brand-400)" />
              <strong>2. Tower / Block</strong>
            </label>
            <select
              className="input"
              value={selectedTowerId}
              onChange={(e) => {
                setSelectedTowerId(e.target.value);
                setSelectedFloor(1);
              }}
              style={{ background: 'var(--color-surface-2)', fontWeight: 600 }}
              disabled={!layoutData?.towers || layoutData.towers.length === 0}
            >
              {layoutData?.towers && layoutData.towers.length > 0 ? (
                layoutData.towers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.code ? `(${t.code})` : ''} — {t.totalFloors ?? 1} Floors
                  </option>
                ))
              ) : (
                <option value="">No Towers Configured</option>
              )}
            </select>
          </div>

          {/* 3. Floor Selector */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <Maximize2 size={14} color="var(--color-brand-400)" />
              <strong>3. Floor Level</strong>
            </label>
            <select
              className="input"
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(Number(e.target.value))}
              style={{ background: 'var(--color-surface-2)', fontWeight: 600 }}
              disabled={!layoutData?.availableFloors || layoutData.availableFloors.length === 0}
            >
              {layoutData?.availableFloors && layoutData.availableFloors.length > 0 ? (
                layoutData.availableFloors.map((f) => (
                  <option key={f} value={f}>
                    Floor {f}
                  </option>
                ))
              ) : (
                <option value={1}>Floor 1</option>
              )}
            </select>
          </div>
        </div>

        {/* ── Floor Pills for Quick Cinema Switching ── */}
        {layoutData?.availableFloors && layoutData.availableFloors.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginRight: '4px' }}>
              Floors:
            </span>
            {layoutData.availableFloors.map((f) => (
              <button
                key={f}
                type="button"
                className={`btn ${selectedFloor === f ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-full)',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setSelectedFloor(f)}
              >
                Floor {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Legend & Summary Statistics Banner ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            background: 'var(--color-surface-1)',
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
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand-400)',
            }}
          >
            <Grid size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total on Floor {selectedFloor}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{layoutData?.summary?.totalApartments ?? 0}</div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-success-500)',
            }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success-500)', fontWeight: 600 }}>Available / Vacant</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success-500)' }}>
              {layoutData?.summary?.availableCount ?? 0}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
            }}
          >
            <UserCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600 }}>Occupied Units</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#60a5fa' }}>
              {layoutData?.summary?.occupiedCount ?? 0}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-warning-500)',
            }}
          >
            <Wrench size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-warning-500)', fontWeight: 600 }}>Maintenance / Reserved</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-warning-500)' }}>
              {layoutData?.summary?.maintenanceCount ?? 0}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface-1)',
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
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(148, 163, 184, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            <Ban size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Inactive</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>
              {layoutData?.summary?.inactiveCount ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search, Filters & View Mode Switcher ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        {/* Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(['ALL', 'VACANT', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE'] as const).map((st) => {
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                className={`btn ${active ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-md)',
                }}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'ALL' && 'All Statuses'}
                {st === 'VACANT' && '🟢 Vacant'}
                {st === 'OCCUPIED' && '🔵 Occupied'}
                {st === 'MAINTENANCE' && '🟠 Maintenance'}
                {st === 'INACTIVE' && '⚪ Inactive'}
              </button>
            );
          })}
        </div>

        {/* Search & View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search Unit #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              className="btn-ghost"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: viewMode === 'grid' ? 'var(--color-surface-3)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
              }}
              onClick={() => setViewMode('grid')}
              title="Cinema seat-booking grid layout"
            >
              <Grid size={15} />
              <span>Seat Map</span>
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: viewMode === 'table' ? 'var(--color-surface-3)' : 'transparent',
                color: viewMode === 'table' ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
              }}
              onClick={() => setViewMode('table')}
              title="Accessible table list view"
            >
              <List size={15} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Error Notification ── */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: 'hsl(0, 84%, 12%)',
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

      {/* ── Loading State ── */}
      {isLoading ? (
        <div
          style={{
            padding: 'var(--space-16)',
            textAlign: 'center',
            background: 'var(--color-surface-1)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Loader2 size={36} color="var(--color-brand-400)" className="animate-spin" style={{ margin: '0 auto var(--space-4)' }} />
          <h4 style={{ fontWeight: 600 }}>Loading Building Availability Grid...</h4>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Fetching apartments, occupancy records, and room layouts
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Cinema Seat-Booking Availability Grid ── */
        <div
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-8)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Cinema Hallway / Corridor Header */}
          <div className="cinema-screen-corridor">
            <div className="cinema-screen-bar" />
            <div className="cinema-screen-label">
              MAIN ELEVATOR & CORRIDOR LOBBY — FLOOR {selectedFloor}
            </div>
          </div>

          {displayedApartments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
              <BuildingIcon size={44} color="var(--color-text-muted)" style={{ margin: '0 auto var(--space-3)' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                No Apartments Found on Floor {selectedFloor}
              </h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto var(--space-6)' }}>
                No units match the selected filters on this floor. Add your first apartment or choose a different floor level.
              </p>
              {canManage && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setAptForm({
                      unitNumber: '',
                      floor: selectedFloor,
                      towerId: selectedTowerId,
                      areaSqft: 900,
                      roomCount: 2,
                      status: 'VACANT',
                      notes: '',
                    });
                    setShowAddAptModal(true);
                  }}
                >
                  <Plus size={16} /> Add Apartment on Floor {selectedFloor}
                </button>
              )}
            </div>
          ) : (
            <div className="cinema-grid" style={{ marginTop: 'var(--space-6)' }}>
              {displayedApartments.map((apt) => {
                const badgeInfo = getStatusBadge(apt.computedStatus);
                const IconComponent = badgeInfo.icon;
                const isSelected = selectedApartment?.id === apt.id;
                const arrearsNum = Number(apt.outstandingArrears ?? 0);

                return (
                  <div
                    key={apt.id}
                    className={`cinema-apt-card ${badgeInfo.cardClass}`}
                    style={{
                      outline: isSelected ? '2px solid var(--color-brand-400)' : 'none',
                      outlineOffset: isSelected ? '2px' : '0',
                    }}
                    onClick={() => handleSelectApartment(apt)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Apartment Unit ${apt.unitNumber}, status ${badgeInfo.label}, ${apt.roomsCount} rooms, area ${apt.effectiveAreaSqft} square feet`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectApartment(apt);
                      }
                    }}
                  >
                    {/* Top Row: Unit Number & Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Home size={16} color="var(--color-brand-400)" />
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {apt.unitNumber}
                        </span>
                      </div>

                      <span
                        className={`badge ${badgeInfo.badgeClass}`}
                        style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <IconComponent size={11} />
                        <span>{apt.computedStatus}</span>
                      </span>
                    </div>

                    {/* Middle Row: Specs (Rooms & Authoritative Area) */}
                    <div style={{ margin: 'var(--space-3) 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: 'var(--color-surface-3)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {apt.roomsCount} {apt.roomsCount === 1 ? 'Room' : 'Rooms'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: 'var(--color-surface-3)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {Number(apt.effectiveAreaSqft).toLocaleString()} sq ft
                      </span>
                    </div>

                    {/* Bottom Row: Resident Indicator & Arrears */}
                    <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: apt.residentName ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                          fontWeight: apt.residentName ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {apt.residentName ? (
                          <>
                            <span style={{ color: '#60a5fa' }}>👤</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{apt.residentName}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--color-success-500)', fontStyle: 'italic' }}>✨ Vacant / Available</span>
                        )}
                      </div>

                      {arrearsNum > 0 && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-warning-500)',
                            fontWeight: 700,
                            marginTop: '2px',
                          }}
                        >
                          Arrears: Rs. {arrearsNum.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Apartment in Grid Box */}
              {canManage && (
                <div
                  className="cinema-apt-card cinema-apt-card--add"
                  onClick={() => {
                    setAptForm({
                      unitNumber: '',
                      floor: selectedFloor,
                      towerId: selectedTowerId,
                      areaSqft: 900,
                      roomCount: 2,
                      status: 'VACANT',
                      notes: '',
                    });
                    setActionError(null);
                    setShowAddAptModal(true);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Add new apartment on Floor ${selectedFloor}`}
                >
                  <Plus size={24} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>+ Add Apartment</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Floor {selectedFloor}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Accessible Table View Alternative ── */
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Unit #</th>
                <th>Floor</th>
                <th>Status</th>
                <th>Rooms</th>
                <th>Total Area</th>
                <th>Assigned Resident</th>
                <th>Outstanding Arrears</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedApartments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    No apartments match your search or filter.
                  </td>
                </tr>
              ) : (
                displayedApartments.map((apt) => {
                  const badgeInfo = getStatusBadge(apt.computedStatus);
                  const arrearsNum = Number(apt.outstandingArrears ?? 0);

                  return (
                    <tr
                      key={apt.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelectApartment(apt)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Home size={15} color="var(--color-brand-400)" />
                          <strong>{apt.unitNumber}</strong>
                        </div>
                      </td>
                      <td>Floor {apt.floor}</td>
                      <td>
                        <span className={`badge ${badgeInfo.badgeClass}`}>{apt.computedStatus}</span>
                      </td>
                      <td>{apt.roomsCount} Rooms</td>
                      <td>{Number(apt.effectiveAreaSqft).toLocaleString()} sq ft</td>
                      <td>
                        {apt.residentName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>👤</span>
                            <span>{apt.residentName}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-success-500)', fontStyle: 'italic' }}>Vacant</span>
                        )}
                      </td>
                      <td>
                        {arrearsNum > 0 ? (
                          <span style={{ color: 'var(--color-warning-500)', fontWeight: 700 }}>
                            Rs. {arrearsNum.toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Rs. 0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectApartment(apt);
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Side Panel Drawer: Apartment Details & Visual Room Layout ── */}
      {selectedApartment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 600,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedApartment(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              height: '100%',
              background: 'var(--color-surface-1)',
              borderLeft: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: 'var(--space-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                background: 'var(--color-surface-2)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800 }}>
                    Unit {selectedApartment.unitNumber}
                  </h3>
                  <span className={`badge ${getStatusBadge(selectedApartment.computedStatus).badgeClass}`}>
                    {selectedApartment.computedStatus}
                  </span>
                </div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  {layoutData?.building?.name} • Floor {selectedApartment.floor}
                </p>
              </div>

              <button
                className="btn-ghost"
                onClick={() => setSelectedApartment(null)}
                style={{ padding: 'var(--space-2)' }}
                aria-label="Close panel"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* Quick Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Area</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '2px' }}>
                    {detailedApartment?.totalRoomArea ?? selectedApartment.effectiveAreaSqft} sq ft
                  </div>
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Rooms Count</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '2px' }}>
                    {detailedApartment?.rooms?.length ?? selectedApartment.roomsCount}
                  </div>
                </div>

                <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Outstanding</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: Number(selectedApartment.outstandingArrears) > 0 ? 'var(--color-warning-500)' : 'var(--color-success-500)', marginTop: '2px' }}>
                    Rs. {Number(detailedApartment?.outstandingArrears ?? selectedApartment.outstandingArrears ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Tenancy & Occupancy Section */}
              <div
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={16} color="var(--color-brand-400)" /> Tenancy & Occupant
                  </h4>

                  {canManage && (
                    selectedApartment.residentName ? (
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--color-danger-500)' }}
                        onClick={() => setShowEndTenancyModal(true)}
                      >
                        <UserX size={13} style={{ marginRight: '4px' }} /> End Tenancy
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setRenterForm({ residentName: '', residentEmail: '', residentPhone: '', notes: '' });
                          setActionError(null);
                          setShowAssignRenterModal(true);
                        }}
                      >
                        <UserPlus size={13} style={{ marginRight: '4px' }} /> Assign Renter
                      </button>
                    )
                  )}
                </div>

                {selectedApartment.residentName ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Resident Name: </span>
                      <strong>{selectedApartment.residentName}</strong>
                    </div>
                    {selectedApartment.residentPhone && (
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Phone: </span>
                        <span>{selectedApartment.residentPhone}</span>
                      </div>
                    )}
                    {selectedApartment.residentEmail && (
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Email: </span>
                        <span>{selectedApartment.residentEmail}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-success-500)', fontStyle: 'italic', margin: 0 }}>
                    This unit is currently vacant and ready for tenant allocation.
                  </p>
                )}
              </div>

              {/* ── Section 4: Rooms Specification (Simple Rooms Concept) ── */}
              <div
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-5)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                      <Layers size={16} color="var(--color-brand-400)" />
                      Rooms Specification
                    </h4>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '2px', margin: 0 }}>
                      Total room configuration and apartment dimensions
                    </p>
                  </div>
                  <span
                    className="badge badge-primary"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', fontWeight: 700 }}
                  >
                    {selectedApartment.roomsCount} {selectedApartment.roomsCount === 1 ? 'Room' : 'Rooms'}
                  </span>
                </div>

                {roomUpdateSuccess && (
                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'hsl(142, 70%, 12%)',
                      border: '1px solid var(--color-success-500)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-success-100)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    <CheckCircle2 size={15} color="var(--color-success-500)" />
                    <span>{roomUpdateSuccess}</span>
                  </div>
                )}

                {/* Specs overview */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'var(--space-3)',
                    marginBottom: canManage ? 'var(--space-4)' : 0,
                  }}
                >
                  <div style={{ background: 'var(--color-surface-1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total Rooms</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {selectedApartment.roomsCount}
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-surface-1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Floor Area</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-brand-400)' }}>
                      {Number(selectedApartment.effectiveAreaSqft).toLocaleString()} sq ft
                    </div>
                  </div>
                </div>

                {/* Authorized Staff Room Count Editor */}
                {canManage && (
                  <div
                    style={{
                      borderTop: '1px solid var(--color-border-subtle)',
                      paddingTop: 'var(--space-3)',
                      marginTop: 'var(--space-3)',
                    }}
                  >
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Authorized Staff: Set & Edit Room Count
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '6px 12px', fontWeight: 700 }}
                          onClick={() => setRoomCountInput(prev => Math.max(1, prev - 1))}
                          disabled={isSubmitting || roomCountInput <= 1}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={roomCountInput}
                          onChange={(e) => setRoomCountInput(Math.max(1, Number(e.target.value)))}
                          style={{
                            width: '50px',
                            textAlign: 'center',
                            border: 'none',
                            background: 'transparent',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: 'var(--color-text-primary)',
                          }}
                        />
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '6px 12px', fontWeight: 700 }}
                          onClick={() => setRoomCountInput(prev => prev + 1)}
                          disabled={isSubmitting}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleSaveRoomCount}
                        disabled={isSubmitting || roomCountInput === selectedApartment.roomsCount}
                      >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span>Update Room Count</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial & Invoices Summary */}
              {detailedApartment?.invoices && detailedApartment.invoices.length > 0 && (
                <div
                  style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-5)',
                  }}
                >
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-3)' }}>
                    <CreditCard size={16} color="var(--color-brand-400)" />
                    Recent Billing Records
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detailedApartment.invoices.slice(0, 3).map((inv: any) => (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                          padding: '6px 0',
                          borderBottom: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div>
                          <strong>{inv.invoiceNumber}</strong>
                          <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                            ({inv.periodCode})
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700 }}>Rs. {Number(inv.totalDue).toLocaleString()}</span>
                          <span
                            className={`badge ${inv.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}
                            style={{ marginLeft: '8px', fontSize: '0.65rem' }}
                          >
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {canManage && (
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setAptForm({
                        unitNumber: selectedApartment.unitNumber,
                        floor: selectedApartment.floor,
                        towerId: selectedApartment.towerId || '',
                        areaSqft: Number(selectedApartment.areaSqft),
                        roomCount: selectedApartment.roomsCount || 1,
                        status: selectedApartment.status,
                        notes: selectedApartment.notes || '',
                      });
                      setActionError(null);
                      setShowEditAptModal(true);
                    }}
                  >
                    <Edit2 size={15} style={{ marginRight: '6px' }} />
                    Edit Apartment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Apartment ── */}
      {showAddAptModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 700,
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
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Add Apartment on Floor {selectedFloor}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Creates a real apartment unit record persisted in the database.
            </p>

            {actionError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'hsl(0, 84%, 12%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  color: 'hsl(0, 100%, 90%)',
                  fontSize: '0.85rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={16} color="var(--color-danger-500)" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateApartment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Apartment / Unit Number *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. A-107"
                  value={aptForm.unitNumber}
                  onChange={(e) => setAptForm({ ...aptForm, unitNumber: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Floor *</label>
                  <input
                    type="number"
                    className="input"
                    value={aptForm.floor}
                    onChange={(e) => setAptForm({ ...aptForm, floor: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Area (sq ft) *</label>
                  <input
                    type="number"
                    className="input"
                    value={aptForm.areaSqft}
                    onChange={(e) => setAptForm({ ...aptForm, areaSqft: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rooms Count *</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={aptForm.roomCount}
                    onChange={(e) => setAptForm({ ...aptForm, roomCount: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Availability Status</label>
                <select
                  className="input"
                  value={aptForm.status}
                  onChange={(e) => setAptForm({ ...aptForm, status: e.target.value })}
                  style={{ background: 'var(--color-surface-2)' }}
                >
                  <option value="VACANT">VACANT (Available for occupancy)</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="MAINTENANCE">MAINTENANCE (Reserved/Renovation)</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Ocean view balcony"
                  value={aptForm.notes}
                  onChange={(e) => setAptForm({ ...aptForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddAptModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Apartment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Apartment ── */}
      {showEditAptModal && selectedApartment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 700,
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
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Edit Unit {selectedApartment.unitNumber}
            </h3>

            {actionError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'hsl(0, 84%, 12%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  color: 'hsl(0, 100%, 90%)',
                  fontSize: '0.85rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={16} color="var(--color-danger-500)" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateApartment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Apartment / Unit Number *</label>
                <input
                  type="text"
                  className="input"
                  value={aptForm.unitNumber}
                  onChange={(e) => setAptForm({ ...aptForm, unitNumber: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Floor *</label>
                  <input
                    type="number"
                    className="input"
                    value={aptForm.floor}
                    onChange={(e) => setAptForm({ ...aptForm, floor: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Area (sq ft) *</label>
                  <input
                    type="number"
                    className="input"
                    value={aptForm.areaSqft}
                    onChange={(e) => setAptForm({ ...aptForm, areaSqft: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rooms Count *</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={aptForm.roomCount}
                    onChange={(e) => setAptForm({ ...aptForm, roomCount: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="input"
                  value={aptForm.status}
                  onChange={(e) => setAptForm({ ...aptForm, status: e.target.value })}
                  style={{ background: 'var(--color-surface-2)' }}
                >
                  <option value="VACANT">VACANT (Available)</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="MAINTENANCE">MAINTENANCE (Reserved/Renovation)</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="input"
                  value={aptForm.notes}
                  onChange={(e) => setAptForm({ ...aptForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditAptModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Assign Renter ── */}
      {showAssignRenterModal && selectedApartment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Assign Renter to Unit {selectedApartment.unitNumber}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Assigning a renter marks the unit as OCCUPIED and updates platform tenancy records.
            </p>

            {actionError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'hsl(0, 84%, 12%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  color: 'hsl(0, 100%, 90%)',
                  fontSize: '0.85rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={16} color="var(--color-danger-500)" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleAssignRenter} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Renter / Resident Full Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. John Doe"
                  value={renterForm.residentName}
                  onChange={(e) => setRenterForm({ ...renterForm, residentName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. +94 77 123 4567"
                  value={renterForm.residentPhone}
                  onChange={(e) => setRenterForm({ ...renterForm, residentPhone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="e.g. resident@example.com"
                  value={renterForm.residentEmail}
                  onChange={(e) => setRenterForm({ ...renterForm, residentEmail: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Lease Notes</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 1-year tenancy agreement"
                  value={renterForm.notes}
                  onChange={(e) => setRenterForm({ ...renterForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAssignRenterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: End Tenancy Confirmation ── */}
      {showEndTenancyModal && selectedApartment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              End Tenancy for Unit {selectedApartment.unitNumber}?
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              This will remove resident <strong>{selectedApartment.residentName}</strong> from active occupancy and mark the apartment as <strong>VACANT</strong>. All financial and billing records will remain intact.
            </p>

            {actionError && (
              <div style={{ color: 'var(--color-danger-500)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowEndTenancyModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--color-danger-500)', borderColor: 'var(--color-danger-500)' }}
                onClick={handleEndTenancy}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Ending...' : 'End Tenancy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Room ── */}
      {showAddRoomModal && selectedApartment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Add Room to Unit {selectedApartment.unitNumber}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-4)' }}>
              Adds an individual room component and recalculates authoritative apartment area.
            </p>

            {actionError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'hsl(0, 84%, 12%)',
                  border: '1px solid var(--color-danger-500)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  color: 'hsl(0, 100%, 90%)',
                  fontSize: '0.85rem',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <AlertCircle size={16} color="var(--color-danger-500)" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Room Number / Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Master Bedroom"
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Room Type</label>
                  <select
                    className="input"
                    value={roomForm.roomType}
                    onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value as any })}
                    style={{ background: 'var(--color-surface-2)' }}
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Area (sq ft) *</label>
                  <input
                    type="number"
                    className="input"
                    value={roomForm.areaSqft}
                    onChange={(e) => setRoomForm({ ...roomForm, areaSqft: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Maintenance Rate (Rs./sq ft) (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="Leave empty to use building default rate"
                  value={roomForm.maintenanceRate}
                  onChange={(e) => setRoomForm({ ...roomForm, maintenanceRate: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddRoomModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Room ── */}
      {editingRoom && selectedApartment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
                Manage Room: {editingRoom.roomNumber}
              </h3>
              <button className="btn-ghost" onClick={() => setEditingRoom(null)}>
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div style={{ color: 'var(--color-danger-500)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleUpdateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Room Number / Name *</label>
                <input
                  type="text"
                  className="input"
                  value={editingRoom.roomNumber}
                  onChange={(e) => setEditingRoom({ ...editingRoom, roomNumber: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">Room Type</label>
                  <select
                    className="input"
                    value={editingRoom.roomType}
                    onChange={(e) => setEditingRoom({ ...editingRoom, roomType: e.target.value as any })}
                    style={{ background: 'var(--color-surface-2)' }}
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Area (sq ft) *</label>
                  <input
                    type="number"
                    className="input"
                    value={editingRoom.areaSqft}
                    onChange={(e) => setEditingRoom({ ...editingRoom, areaSqft: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Maintenance Rate (Rs./sq ft)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="Leave empty for building default"
                  value={editingRoom.maintenanceRate ?? ''}
                  onChange={(e) => setEditingRoom({ ...editingRoom, maintenanceRate: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ color: 'var(--color-danger-500)', borderColor: 'var(--color-danger-500)' }}
                  onClick={() => handleDeleteRoom(editingRoom.id)}
                  disabled={isSubmitting}
                >
                  <Trash2 size={14} style={{ marginRight: '4px' }} /> Deactivate Room
                </button>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setEditingRoom(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
