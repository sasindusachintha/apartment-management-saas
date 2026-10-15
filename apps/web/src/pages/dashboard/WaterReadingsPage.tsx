import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Droplets,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Building,
  Home,
  X,
  RefreshCw,
} from 'lucide-react';

interface Building {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  unitNumber: string;
  floor: number;
  ownerName?: string | null;
  residentName?: string | null;
}

interface WaterReading {
  id: string;
  periodCode: string;
  previousReading: number | string;
  currentReading: number | string;
  consumption: number | string;
  ratePerUnit: number | string;
  fixedCharge: number | string;
  totalAmount: number | string;
  readingDate: string;
  notes?: string | null;
  apartment: {
    id: string;
    unitNumber: string;
    floor: number;
    ownerName?: string | null;
    residentName?: string | null;
  };
}

export default function WaterReadingsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [periodCode, setPeriodCode] = useState<string>('2026-10');
  const [readings, setReadings] = useState<WaterReading[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Single Form State
  const [form, setForm] = useState({
    apartmentId: '',
    previousReading: 0,
    currentReading: 0,
    allowCorrection: false,
    ratePerUnit: 100,
    notes: '',
  });

  // Batch Form State
  const [batchRows, setBatchRows] = useState<
    Array<{
      apartmentId: string;
      unitNumber: string;
      ownerName: string;
      previousReading: number;
      currentReading: number;
      allowCorrection: boolean;
    }>
  >([]);

  const canManage = hasPermission('billing.manage');

  // Load Buildings
  const fetchBuildings = useCallback(async () => {
    try {
      const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
      const { data } = await api.get(url);
      setBuildings(data);
      if (data.length > 0 && !selectedBuildingId) {
        setSelectedBuildingId(data[0].id);
      }
    } catch {}
  }, [activeOrg, selectedBuildingId]);

  // Load Readings & Apartments
  const fetchReadings = useCallback(async () => {
    if (!selectedBuildingId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [readingsRes, aptsRes] = await Promise.all([
        api.get(
          `/water-readings?organizationId=${activeOrg?.id || ''}&buildingId=${selectedBuildingId}&periodCode=${periodCode}`,
        ),
        api.get(`/apartments?buildingId=${selectedBuildingId}&isActive=true`),
      ]);

      setReadings(readingsRes.data);
      setApartments(aptsRes.data);

      // Pre-fill batch entry rows
      const existingMap = new Map(readingsRes.data.map((r: any) => [r.apartment.id, r]));
      const rows = aptsRes.data.map((a: any) => {
        const existing: any = existingMap.get(a.id);
        return {
          apartmentId: a.id,
          unitNumber: a.unitNumber,
          ownerName: a.residentName || a.ownerName || '-',
          previousReading: existing ? Number(existing.previousReading) : 0,
          currentReading: existing ? Number(existing.currentReading) : 0,
          allowCorrection: false,
        };
      });
      setBatchRows(rows);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to fetch water readings';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, selectedBuildingId, periodCode]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  // Handle Apartment Selection in Single Modal -> Fetch latest reading
  const handleApartmentChange = async (aptId: string) => {
    setForm((prev) => ({ ...prev, apartmentId: aptId }));
    if (!aptId) return;
    try {
      const { data } = await api.get(`/water-readings/latest/${aptId}`);
      setForm((prev) => ({
        ...prev,
        apartmentId: aptId,
        previousReading: data.latestReading,
        currentReading: data.latestReading, // defaults to same, user types new
        ratePerUnit: data.defaultTariffPerUnit,
      }));
    } catch {}
  };

  // Submit Single Reading
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id || !selectedBuildingId || !form.apartmentId) return;

    if (form.currentReading < form.previousReading && !form.allowCorrection) {
      setModalError(
        'Current reading cannot be lower than previous reading without checking "Authorized Correction".',
      );
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/water-readings', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId,
        apartmentId: form.apartmentId,
        periodCode,
        previousReading: Number(form.previousReading),
        currentReading: Number(form.currentReading),
        ratePerUnit: Number(form.ratePerUnit),
        allowCorrection: form.allowCorrection,
        notes: form.notes || undefined,
      });

      setShowAddModal(false);
      setSuccessMsg('Water reading recorded successfully.');
      fetchReadings();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to record reading';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Batch Readings
  const handleBatchSubmit = async () => {
    if (!activeOrg?.id || !selectedBuildingId) return;

    // Validate any negative consumption
    const invalid = batchRows.find(
      (r) => r.currentReading > 0 && r.currentReading < r.previousReading && !r.allowCorrection,
    );
    if (invalid) {
      alert(
        `Unit ${invalid.unitNumber} has a current reading (${invalid.currentReading}) lower than previous (${invalid.previousReading}). Please check Authorized Correction or verify the input.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const readingsToPost = batchRows
        .filter((r) => r.currentReading > 0 || r.previousReading > 0)
        .map((r) => ({
          apartmentId: r.apartmentId,
          previousReading: Number(r.previousReading),
          currentReading: Number(r.currentReading),
          allowCorrection: r.allowCorrection,
        }));

      const { data } = await api.post('/water-readings/bulk', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId,
        periodCode,
        readings: readingsToPost,
      });

      setSuccessMsg(data.message);
      fetchReadings();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to save batch water readings',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
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
            Water Meter Readings & Billing
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Record meter readings, calculate consumption automatically, and integrate water charges directly into monthly invoices.
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                setForm({
                  apartmentId: '',
                  previousReading: 0,
                  currentReading: 0,
                  allowCorrection: false,
                  ratePerUnit: 100,
                  notes: '',
                });
                setModalError(null);
                setShowAddModal(true);
              }}
            >
              <Plus size={16} /> Single Meter Entry
            </button>
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={handleBatchSubmit}
              disabled={isSubmitting}
            >
              <Save size={16} /> Save All Meter Readings
            </button>
          </div>
        )}
      </div>

      {/* Building & Period Ribbon */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          alignItems: 'center',
        }}
      >
        <div style={{ minWidth: '220px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Condominium Building
          </label>
          <select
            className="input"
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '180px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
            Billing Period
          </label>
          <input
            type="text"
            className="input"
            value={periodCode}
            onChange={(e) => setPeriodCode(e.target.value)}
            placeholder="YYYY-MM (e.g. 2026-10)"
            style={{ padding: '0.5rem' }}
          />
        </div>

        <button className="btn btn-outline" onClick={fetchReadings} style={{ alignSelf: 'flex-end', padding: '0.55rem' }} title="Reload">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'hsl(142, 76%, 12%)',
            border: '1px solid var(--color-success-500)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="var(--color-success-500)" />
            <span>{successMsg}</span>
          </div>
          <button className="btn-ghost" onClick={() => setSuccessMsg(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
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

      {/* Meter Entry Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                Meter Readings Sheet — {periodCode}
              </h3>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                {readings.length} Saved
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Enter current readings for each unit. Consumption and billing amounts are calculated in real-time.
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto var(--space-3)' }} />
            <p>Loading meter sheets...</p>
          </div>
        ) : batchRows.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Droplets size={40} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>No apartments found for meter recording</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Unit No</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Occupant</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', width: '140px' }}>Previous Reading</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', width: '140px' }}>Current Reading</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Units Consumed</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Estimated Charge</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Correction</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.map((row, idx) => {
                  const consumption = Math.max(0, row.currentReading - row.previousReading);
                  const isNegative = row.currentReading > 0 && row.currentReading < row.previousReading;
                  const estimatedCharge = (consumption * 100); // Rs. 100 per unit standard

                  return (
                    <tr
                      key={row.apartmentId}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        background: isNegative ? 'hsl(0, 84%, 10%)' : 'inherit',
                      }}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Home size={14} color="var(--color-brand-400)" />
                          Unit {row.unitNumber}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem' }}>
                        {row.ownerName}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                        <input
                          type="number"
                          className="input"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                          value={row.previousReading}
                          onChange={(e) => {
                            const newRows = [...batchRows];
                            newRows[idx].previousReading = Number(e.target.value);
                            setBatchRows(newRows);
                          }}
                          disabled={!canManage}
                        />
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                        <input
                          type="number"
                          className="input"
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.85rem',
                            borderColor: isNegative && !row.allowCorrection ? 'var(--color-danger-500)' : undefined,
                          }}
                          value={row.currentReading}
                          onChange={(e) => {
                            const newRows = [...batchRows];
                            newRows[idx].currentReading = Number(e.target.value);
                            setBatchRows(newRows);
                          }}
                          disabled={!canManage}
                        />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700 }}>
                        {isNegative ? (
                          <span style={{ color: 'var(--color-danger-500)', fontSize: '0.8rem' }}>
                            {row.currentReading - row.previousReading} (Invalid)
                          </span>
                        ) : (
                          <span>{consumption.toFixed(2)} units</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 800 }}>
                        Rs. {estimatedCharge.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          title="Authorized meter correction"
                          checked={row.allowCorrection}
                          onChange={(e) => {
                            const newRows = [...batchRows];
                            newRows[idx].allowCorrection = e.target.checked;
                            setBatchRows(newRows);
                          }}
                          disabled={!canManage}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── SINGLE METER ENTRY MODAL ────────────────────────── */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Record Single Meter Reading
              </h3>
              <button className="btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: 'var(--space-3)', background: 'hsl(0, 84%, 12%)', border: '1px solid var(--color-danger-500)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger-100)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label">Apartment *</label>
                <select
                  className="input"
                  value={form.apartmentId}
                  onChange={(e) => handleApartmentChange(e.target.value)}
                  required
                >
                  <option value="">Select Apartment...</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Unit {a.unitNumber} ({a.ownerName || 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <label className="label">Previous Reading *</label>
                  <input
                    type="number"
                    className="input"
                    value={form.previousReading}
                    onChange={(e) => setForm({ ...form, previousReading: Number(e.target.value) })}
                    required
                    min={0}
                  />
                </div>
                <div>
                  <label className="label">Current Reading *</label>
                  <input
                    type="number"
                    className="input"
                    value={form.currentReading}
                    onChange={(e) => setForm({ ...form, currentReading: Number(e.target.value) })}
                    required
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="label">Tariff Rate per Unit (Rs.)</label>
                <input
                  type="number"
                  className="input"
                  value={form.ratePerUnit}
                  onChange={(e) => setForm({ ...form, ratePerUnit: Number(e.target.value) })}
                  min={0}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="singleCorrection"
                  checked={form.allowCorrection}
                  onChange={(e) => setForm({ ...form, allowCorrection: e.target.checked })}
                />
                <label htmlFor="singleCorrection" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Allow meter rollover / authorized negative correction
                </label>
              </div>

              <div>
                <label className="label">Notes (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Meter replaced or inspected"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Record Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
