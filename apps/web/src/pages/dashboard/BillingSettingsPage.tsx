import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Sliders,
  Landmark,
  Droplets,
  Calendar,
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  Info,
  Percent,
} from 'lucide-react';

interface Building {
  id: string;
  name: string;
}

interface BillingSettingData {
  id?: string;
  organizationId: string;
  buildingId?: string | null;
  maintenanceRatePerSqft: number;
  defaultDueDays: number;
  latePaymentPenaltyPercent: number;
  latePaymentGraceDays: number;
  waterTariffPerUnit: number;
  waterFixedCharge: number;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  paymentInstructions: string;
}

export default function BillingSettingsPage() {
  const { activeOrg, hasPermission } = useAuth();
  const canManage = hasPermission('billing.manage');

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [maintenanceRate, setMaintenanceRate] = useState<number>(10);
  const [dueDays, setDueDays] = useState<number>(15);
  const [penaltyPercent, setPenaltyPercent] = useState<number>(0);
  const [graceDays, setGraceDays] = useState<number>(5);
  const [waterTariff, setWaterTariff] = useState<number>(100);
  const [waterFixedCharge, setWaterFixedCharge] = useState<number>(0);

  // Bank Details (Span Tower IX default)
  const [bankName, setBankName] = useState('Commercial Bank of Ceylon');
  const [accountName, setAccountName] = useState('Management Corporation - Span Tower IX');
  const [accountNumber, setAccountNumber] = useState('100045678901');
  const [bankBranch, setBankBranch] = useState('Wellawatte Branch');
  const [paymentInstructions, setPaymentInstructions] = useState(
    'Please deposit cheques drawn in favour of "Management Corporation - Span Tower IX" or direct transfer using Apartment No as payment reference.'
  );

  // Fetch Buildings
  useEffect(() => {
    async function loadBuildings() {
      try {
        const url = activeOrg ? `/buildings?organizationId=${activeOrg.id}` : '/buildings';
        const { data } = await api.get(url);
        setBuildings(data);
        if (data.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(data[0].id);
        }
      } catch (err: unknown) {
        console.error('Failed to load buildings', err);
      }
    }
    loadBuildings();
  }, [activeOrg]);

  // Fetch Billing Settings for selected building
  const fetchSettings = useCallback(async () => {
    if (!selectedBuildingId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get<BillingSettingData>(`/billing/settings/${selectedBuildingId}`);
      if (data) {
        setMaintenanceRate(Number(data.maintenanceRatePerSqft) || 10);
        setDueDays(Number(data.defaultDueDays) || 15);
        setPenaltyPercent(Number(data.latePaymentPenaltyPercent) || 0);
        setGraceDays(Number(data.latePaymentGraceDays) || 5);
        setWaterTariff(Number(data.waterTariffPerUnit) || 100);
        setWaterFixedCharge(Number(data.waterFixedCharge) || 0);
        setBankName(data.bankName || 'Commercial Bank of Ceylon');
        setAccountName(data.bankAccountName || 'Management Corporation - Span Tower IX');
        setAccountNumber(data.bankAccountNumber || '100045678901');
        setBankBranch(data.bankBranch || 'Wellawatte Branch');
        setPaymentInstructions(data.paymentInstructions || '');
      }
    } catch (err: unknown) {
      console.error('Failed to fetch settings', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBuildingId]);

  useEffect(() => {
    if (selectedBuildingId) {
      fetchSettings();
    }
  }, [selectedBuildingId, fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      setError('You do not have permission to modify billing settings');
      return;
    }
    if (!activeOrg?.id) {
      setError('Active organization not found');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/billing/settings', {
        organizationId: activeOrg.id,
        buildingId: selectedBuildingId || undefined,
        maintenanceRatePerSqft: Number(maintenanceRate),
        defaultDueDays: Number(dueDays),
        latePaymentPenaltyPercent: Number(penaltyPercent),
        latePaymentGraceDays: Number(graceDays),
        waterTariffPerUnit: Number(waterTariff),
        waterFixedCharge: Number(waterFixedCharge),
        bankName,
        bankAccountName: accountName,
        bankAccountNumber: accountNumber,
        bankBranch,
        paymentInstructions,
      });

      setSuccess('Billing settings saved and applied successfully.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Failed to save billing settings';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Live calculation preview for 1,000 sq ft apartment
  const exampleSqFt = 1000;
  const exampleMaintenance = exampleSqFt * (Number(maintenanceRate) || 0);
  const exampleWaterUnits = 10;
  const exampleWater = exampleWaterUnits * (Number(waterTariff) || 0) + (Number(waterFixedCharge) || 0);
  const exampleTotal = exampleMaintenance + exampleWater;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={26} color="var(--color-brand-400)" /> Billing & Tariff Configuration
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Configure maintenance tariffs, water rate schedules, late payment grace periods, and remittance bank accounts
          </p>
        </div>

        {buildings.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color="var(--color-text-muted)" />
            <select
              className="input-select"
              style={{ minWidth: '220px', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1rem', background: 'hsla(0, 84%, 60%, 0.1)', border: '1px solid hsla(0, 84%, 60%, 0.3)', borderRadius: 'var(--radius-md)', color: 'hsl(0, 84%, 60%)', fontSize: '0.875rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1rem', background: 'hsla(142, 71%, 45%, 0.1)', border: '1px solid hsla(142, 71%, 45%, 0.3)', borderRadius: 'var(--radius-md)', color: 'hsl(142, 71%, 45%)', fontSize: '0.875rem' }}>
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12)', gap: '12px' }}>
          <Loader2 size={24} className="spin" color="var(--color-brand-400)" />
          <span>Loading billing settings...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Section 1: Maintenance Tariffs */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
              <Sliders size={18} color="var(--color-brand-400)" /> Monthly Maintenance Tariff
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              The maintenance fee is calculated automatically based on each apartment's registered square-foot area: <code>Area (sq ft) × Rate (Rs./sqft)</code>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Maintenance Rate (LKR / sq ft) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    disabled={!canManage}
                    value={maintenanceRate}
                    onChange={(e) => setMaintenanceRate(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.5rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: '1rem', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              <div style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-brand-300)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Info size={14} /> Example Calculation (Unit 4B · 1,000 sq ft)
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  1,000 sq ft × Rs. {maintenanceRate.toFixed(2)} = <strong style={{ color: 'var(--color-brand-300)' }}>Rs. {exampleMaintenance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Water Billing Tariffs */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
              <Droplets size={18} color="#06b6d4" /> Submeter Water Tariff & Utility Charges
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              Submeter water charges are calculated on actual monthly consumption: <code>(Units × Tariff) + Fixed Charge</code>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Water Tariff Rate (LKR / m³ or Unit) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    disabled={!canManage}
                    value={waterTariff}
                    onChange={(e) => setWaterTariff(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.5rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Fixed Water Service Charge (LKR / Month)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!canManage}
                    value={waterFixedCharge}
                    onChange={(e) => setWaterFixedCharge(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.5rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>
                <Info size={14} /> Example Consumption (10 Units)
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                10 units × Rs. {waterTariff.toFixed(2)} + Rs. {waterFixedCharge.toFixed(2)} = <strong style={{ color: '#06b6d4' }}>Rs. {exampleWater.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  (Est. Monthly Total: Rs. {exampleTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Billing Deadlines & Late Penalties */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
              <Calendar size={18} color="var(--color-brand-400)" /> Terms, Due Dates & Late Penalties
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Default Due Days (from bill issue date) *
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input
                    type="number"
                    min="1"
                    max="90"
                    required
                    disabled={!canManage}
                    value={dueDays}
                    onChange={(e) => setDueDays(parseInt(e.target.value) || 15)}
                    style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.5rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Late Payment Penalty Percentage (%)
                </label>
                <div style={{ position: 'relative' }}>
                  <Percent size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={!canManage}
                    value={penaltyPercent}
                    onChange={(e) => setPenaltyPercent(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.5rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Late Penalty Grace Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  disabled={!canManage}
                  value={graceDays}
                  onChange={(e) => setGraceDays(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Bank Remittance Details (Span Tower IX) */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)' }}>
              <Landmark size={18} color="var(--color-brand-400)" /> Bank Remittance Information (Printed on PDF Invoices)
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              These banking coordinates appear on all generated PDF invoices and monthly payment slips for resident remittance.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={!canManage}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Account Name / Beneficiary *
                </label>
                <input
                  type="text"
                  required
                  disabled={!canManage}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  disabled={!canManage}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontFamily: 'monospace', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Bank Branch
                </label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                Payment Instructions / Remittance Notes
              </label>
              <textarea
                rows={3}
                disabled={!canManage}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.75rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Action Bar */}
          {canManage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
              >
                {isSaving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                {isSaving ? 'Saving Settings...' : 'Save Billing Settings'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
