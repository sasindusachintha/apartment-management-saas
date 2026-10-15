import React from 'react';

export interface OfficialBillData {
  id?: string;
  invoiceNumber: string;
  issueDate?: string | Date;
  dueDate?: string | Date;
  status: string;
  periodCode: string;
  periodName?: string;
  buildingName?: string;
  buildingAddress?: string;
  towerName?: string | null;
  unitNumber: string;
  floor?: number;
  areaSqft?: number | string;
  ownerName?: string | null;
  residentName?: string | null;
  ownerPhone?: string | null;
  maintenanceRate?: number | string;
  maintenanceAmount: number | string;
  waterAmount: number | string;
  otherChargesAmount?: number | string;
  penaltyAmount?: number | string;
  discountAmount?: number | string;
  currentChargesTotal?: number | string;
  previousArrears?: number | string;
  totalDue: number | string;
  paidAmount?: number | string;
  balanceDue: number | string;
  items?: Array<{
    itemType: string;
    description: string;
    quantity: number | string;
    unitRate: number | string;
    amount: number | string;
    roomId?: string | null;
    roomName?: string | null;
    roomType?: string | null;
  }>;
  waterReading?: {
    previousReading: number | string;
    currentReading: number | string;
    consumption: number | string;
    ratePerUnit: number | string;
    fixedCharge: number | string;
    totalAmount: number | string;
  } | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankBranch?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactPerson?: string | null;
}

export function formatSriLankanAmount(amount: number | string | undefined | null): string {
  const num = Number(amount ?? 0);
  const fixed = num.toFixed(2);
  const [rupees, cents] = fixed.split('.');
  if (cents === '00') {
    return `${Number(rupees).toLocaleString('en-US')}/=`;
  }
  return `${Number(rupees).toLocaleString('en-US')}/${cents}`;
}

export function formatCurrencyStandard(amount: number | string | undefined | null): string {
  const num = Number(amount ?? 0);
  return `Rs. ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMonthName(periodCode?: string, periodName?: string): string {
  if (periodName) return periodName;
  if (!periodCode) return '-';
  const parts = periodCode.split('-');
  if (parts.length === 2) {
    const year = parts[0];
    const monthNum = parseInt(parts[1], 10);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    if (monthNum >= 1 && monthNum <= 12) {
      return `${months[monthNum - 1]} ${year}`;
    }
  }
  return periodCode;
}

interface OfficialBillViewProps {
  invoice: any;
  forwardedRef?: React.Ref<HTMLDivElement>;
}

export default function OfficialBillView({ invoice, forwardedRef }: OfficialBillViewProps) {
  if (!invoice) return null;

  const building = invoice.building || {};
  const buildingSettings = building.billingSettings?.[0] || {};
  const apartment = invoice.apartment || {};
  const tower = apartment.tower || {};

  const buildingName = invoice.buildingName || building.name || 'Span Tower IX';
  const unitNumber = invoice.unitNumber || apartment.unitNumber || '—';
  const towerName = invoice.towerName !== undefined ? invoice.towerName : tower.name;
  const floor = invoice.floor !== undefined ? invoice.floor : apartment.floor;
  const areaSqft = invoice.areaSqft || apartment.areaSqft || 0;

  // Format apartment string exactly like PDF:
  let aptDisplay = unitNumber;
  if (towerName) {
    aptDisplay = `${towerName} · Floor ${floor} · Unit ${unitNumber}`;
  } else if (floor !== undefined) {
    aptDisplay = `Floor ${floor} · Unit ${unitNumber}`;
  }

  const periodCode = invoice.periodCode || invoice.billingPeriod?.periodCode || '';
  const monthDisplay = formatMonthName(periodCode, invoice.periodName || invoice.billingPeriod?.name);

  const previousArrears = invoice.previousArrears ?? 0;
  const maintenanceAmount = invoice.maintenanceAmount ?? 0;
  const waterAmount = invoice.waterAmount ?? 0;
  const totalDue = invoice.totalDue ?? 0;
  const paidAmount = invoice.paidAmount ?? 0;
  const balanceDue = invoice.balanceDue ?? 0;

  const items = invoice.items || [];
  const roomItems = items.filter(
    (i: any) => i.itemType === 'ROOM_MAINTENANCE' || i.roomId || (i.description && i.description.includes('sq. ft.'))
  );

  const otherCharges = items.filter(
    (i: any) => i.itemType !== 'MAINTENANCE' && i.itemType !== 'ROOM_MAINTENANCE' && i.itemType !== 'WATER'
  );

  const wr = invoice.waterReading;

  // Bank coordinates
  const bankAccName = invoice.bankAccountName || buildingSettings.bankAccountName || `${buildingName} Management Corporation`;
  const bankAccNum = invoice.bankAccountNumber || buildingSettings.bankAccountNumber || '003660000312';
  const bankName = invoice.bankName || buildingSettings.bankName || 'Sampath Bank PLC';
  const bankBranch = invoice.bankBranch || buildingSettings.bankBranch || 'Wellawatta Branch';

  const contactEmail = invoice.contactEmail || buildingSettings.contactEmail || 'span.ebenezer@gmail.com';
  const contactPhone = invoice.contactPhone || buildingSettings.contactPhone || '+94 770201034';
  const contactPerson = invoice.contactPerson || buildingSettings.contactPerson || 'Mr. Tony David';

  return (
    <div
      ref={forwardedRef}
      className="official-bill-container"
      style={{
        background: '#ffffff',
        color: '#000000',
        padding: '28px',
        borderRadius: '6px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '12px',
        lineHeight: 1.45,
        maxWidth: '700px',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* ─── 1. Header Title Box ─────────────────────────────── */}
      <div
        style={{
          border: '1.5px solid #000000',
          padding: '8px 12px',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '12.5px',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          background: '#ffffff',
          color: '#000000',
        }}
      >
        {buildingName.toUpperCase()} MANAGEMENT CORPORATION - MAINTENANCE FEE & WATER BILL
      </div>

      {/* ─── 2. Main Information Rows (Apartment, Month, Arrears, Maintenance) ─── */}
      <div style={{ borderLeft: '1.5px solid #000000', borderRight: '1.5px solid #000000' }}>
        {/* Apartment No */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '26px' }}>
          <div
            style={{
              width: '38%',
              padding: '5px 10px',
              fontWeight: 700,
              borderRight: '1px solid #000000',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Apartment No
          </div>
          <div style={{ width: '62%', padding: '5px 10px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            {aptDisplay}
          </div>
        </div>

        {/* Month */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '26px' }}>
          <div
            style={{
              width: '38%',
              padding: '5px 10px',
              fontWeight: 700,
              borderRight: '1px solid #000000',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Month
          </div>
          <div style={{ width: '62%', padding: '5px 10px', display: 'flex', alignItems: 'center' }}>
            {monthDisplay}
          </div>
        </div>

        {/* Previous Dues */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '26px' }}>
          <div
            style={{
              width: '38%',
              padding: '5px 10px',
              fontWeight: 700,
              borderRight: '1px solid #000000',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Previous Dues
          </div>
          <div style={{ width: '62%', padding: '5px 10px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            {formatSriLankanAmount(previousArrears)}
          </div>
        </div>

        {/* Maintenance Fee */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '26px' }}>
          <div
            style={{
              width: '38%',
              padding: '5px 10px',
              fontWeight: 700,
              borderRight: '1px solid #000000',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Maintenance Fee
          </div>
          <div style={{ width: '62%', padding: '5px 10px', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            {formatSriLankanAmount(maintenanceAmount)}
          </div>
        </div>

        {/* ─── 3. Room-by-Room Breakdown Table (if available) ─── */}
        {roomItems.length > 0 && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr',
                background: '#f1f5f9',
                borderBottom: '1px solid #000000',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#1e293b',
              }}
            >
              <div>ROOM PARTICULARS</div>
              <div>TYPE</div>
              <div style={{ textAlign: 'right' }}>AREA (SQ.FT.)</div>
              <div style={{ textAlign: 'right' }}>RATE (Rs.)</div>
              <div style={{ textAlign: 'right' }}>MONTHLY CHARGE</div>
            </div>

            {roomItems.map((r: any, idx: number) => {
              const rName = r.roomName || r.description?.split('(')[0]?.trim() || `Room ${idx + 1}`;
              const rType = r.roomType ? r.roomType.replace(/_/g, ' ') : 'Room';
              return (
                <div
                  key={r.id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '3px 8px',
                    fontSize: '10.5px',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{rName}</div>
                  <div style={{ textTransform: 'capitalize', color: '#475569' }}>{rType.toLowerCase()}</div>
                  <div style={{ textAlign: 'right' }}>{Number(r.quantity).toLocaleString()}</div>
                  <div style={{ textAlign: 'right' }}>{Number(r.unitRate).toFixed(2)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatCurrencyStandard(r.amount)}
                  </div>
                </div>
              );
            })}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr 1.2fr',
                background: '#f8fafc',
                borderBottom: '1px solid #000000',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              <div>TOTAL APARTMENT ROOM AREA & MAINTENANCE</div>
              <div style={{ textAlign: 'right' }}>{Number(areaSqft).toLocaleString()} sq. ft.</div>
              <div style={{ textAlign: 'right' }}>{formatCurrencyStandard(maintenanceAmount)}</div>
            </div>
          </div>
        )}

        {/* ─── 4. Water Bill Details Section ─────────────────── */}
        <div
          style={{
            borderBottom: '1px solid #000000',
            padding: '5px 10px',
            fontWeight: 700,
            fontSize: '11.5px',
            background: '#ffffff',
          }}
        >
          Water Bill Details
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Present Meter Reading
          </div>
          <div style={{ width: '62%', padding: '4px 10px' }}>
            {wr?.currentReading !== undefined && wr?.currentReading !== null ? String(wr.currentReading) : '-'}
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Previous Meter Reading
          </div>
          <div style={{ width: '62%', padding: '4px 10px' }}>
            {wr?.previousReading !== undefined && wr?.previousReading !== null ? String(wr.previousReading) : '-'}
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Units for the Month
          </div>
          <div style={{ width: '62%', padding: '4px 10px' }}>
            {wr?.consumption !== undefined && wr?.consumption !== null ? String(wr.consumption) : '0'}
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Water bill for last month
          </div>
          <div style={{ width: '62%', padding: '4px 10px', fontWeight: 600 }}>
            {formatSriLankanAmount(waterAmount)}
          </div>
        </div>

        {/* ─── 5. Additional Utility Charges & Fees (if any) ─── */}
        {otherCharges.length > 0 && (
          <div>
            <div
              style={{
                borderBottom: '1px solid #000000',
                padding: '5px 10px',
                fontWeight: 700,
                fontSize: '11.5px',
              }}
            >
              Other Utility Charges & Fees
            </div>
            {otherCharges.map((oc: any, idx: number) => (
              <div key={oc.id || idx} style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
                <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
                  {oc.description || 'Additional Charge'}
                </div>
                <div style={{ width: '62%', padding: '4px 10px', fontWeight: 600 }}>
                  {formatSriLankanAmount(oc.amount)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── 6. Total Dues to be Paid ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1.5px solid #000000',
            minHeight: '30px',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              width: '38%',
              padding: '6px 10px',
              fontWeight: 800,
              fontSize: '13px',
              borderRight: '1px solid #000000',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Total Dues to be Paid
          </div>
          <div
            style={{
              width: '62%',
              padding: '6px 10px',
              fontWeight: 800,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {formatSriLankanAmount(totalDue)}
          </div>
        </div>

        {/* Paid and Net Balance if payment made */}
        {Number(paidAmount) > 0 && (
          <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '26px', background: '#f0fdf4' }}>
            <div
              style={{
                width: '38%',
                padding: '5px 10px',
                fontWeight: 700,
                color: '#16a34a',
                borderRight: '1px solid #000000',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Paid Amount
            </div>
            <div
              style={{
                width: '62%',
                padding: '5px 10px',
                fontWeight: 700,
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {formatSriLankanAmount(paidAmount)}
            </div>
          </div>
        )}

        {Number(balanceDue) !== Number(totalDue) && Number(balanceDue) >= 0 && (
          <div style={{ display: 'flex', borderBottom: '1.5px solid #000000', minHeight: '26px', background: '#fef2f2' }}>
            <div
              style={{
                width: '38%',
                padding: '5px 10px',
                fontWeight: 800,
                color: '#dc2626',
                borderRight: '1px solid #000000',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Remaining Balance
            </div>
            <div
              style={{
                width: '62%',
                padding: '5px 10px',
                fontWeight: 800,
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {formatSriLankanAmount(balanceDue)}
            </div>
          </div>
        )}

        {/* ─── 7. Bank Account Details Section ───────────────── */}
        <div
          style={{
            borderBottom: '1px solid #000000',
            padding: '5px 10px',
            fontWeight: 700,
            fontSize: '11.5px',
            textAlign: 'center',
            background: '#ffffff',
          }}
        >
          Bank Account Details
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Account Name
          </div>
          <div style={{ width: '62%', padding: '4px 10px' }}>{bankAccName}</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Account Number
          </div>
          <div style={{ width: '62%', padding: '4px 10px', fontWeight: 600 }}>{bankAccNum}</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Bank
          </div>
          <div style={{ width: '62%', padding: '4px 10px' }}>{bankName}</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1.5px solid #000000', minHeight: '24px' }}>
          <div style={{ width: '38%', padding: '4px 10px', fontWeight: 700, borderRight: '1px solid #000000' }}>
            Branch
          </div>
          <div style={{ width: '62%', padding: '4px 10px' }}>{bankBranch}</div>
        </div>
      </div>

      {/* ─── 8. Remittance & SGM Decision Notice Box ─────────── */}
      <div
        style={{
          border: '1.5px solid #000000',
          marginTop: '10px',
          padding: '12px 14px',
          fontSize: '11px',
          lineHeight: 1.5,
          color: '#000000',
        }}
      >
        <p style={{ margin: '0 0 10px 0' }}>
          Kindly settle the total dues before the end of the month to the mentioned bank account. Please ensure that you
          include your <strong>apartment number</strong> as the payment narration.
        </p>

        <p style={{ margin: '0 0 10px 0' }}>
          Please note that as per a decision taken at the SGM held on 2nd November 2025, a{' '}
          <strong>15% Monthly Penalty</strong> will be imposed on the outstanding dues of the maintenance fees and water
          bills. The penalty amount will be calculated on a pro rata basis for the period that the dues are outstanding,
          and will be added to the following month's maintenance fee and water bill for settlement.
        </p>

        <p style={{ margin: '0 0 4px 0' }}>
          <strong>Example:</strong>
        </p>
        <p style={{ margin: '0 0 10px 0' }}>
          If the outstanding amount due is Rs 20,000/-, the monthly penalty of 15% will be Rs 3000/-. If the amount is
          settled in 10 days, the penalty payable will be 3000/30 x 10 = Rs 1000/-.
        </p>

        <p style={{ margin: '0 0 10px 0' }}>
          The above decision will be implemented with effect from 1st December 2025.
        </p>

        <p style={{ margin: '0 0 4px 0' }}>
          After completing the payment, send the payment slip to {contactEmail}
        </p>
        <p style={{ margin: '0 0 12px 0' }}>
          or WhatsApp it to {contactPerson} ({contactPhone})
        </p>

        <p style={{ margin: 0, fontWeight: 700 }}>
          Thank you for your cooperation.
        </p>
      </div>
    </div>
  );
}
