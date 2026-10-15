import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: Date | string;
  dueDate: Date | string;
  status: string;
  periodCode: string;
  periodName?: string;
  buildingName: string;
  buildingAddress: string;
  towerName?: string | null;
  unitNumber: string;
  floor: number;
  areaSqft: number | string;
  ownerName?: string | null;
  residentName?: string | null;
  ownerPhone?: string | null;
  maintenanceRate: number | string;
  maintenanceAmount: number | string;
  waterAmount: number | string;
  otherChargesAmount: number | string;
  penaltyAmount: number | string;
  discountAmount: number | string;
  currentChargesTotal: number | string;
  previousArrears: number | string;
  totalDue: number | string;
  paidAmount: number | string;
  balanceDue: number | string;
  items: Array<{
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
  paymentInstructions?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactPerson?: string | null;
  noticeText?: string | null;
}

@Injectable()
export class InvoicePdfService {
  formatSriLankanAmount(amount: number | string | undefined): string {
    const num = Number(amount ?? 0);
    // Format as 9640/= if whole number, or 26759/84 if has cents, matching Span Tower IX format
    const fixed = num.toFixed(2);
    const [rupees, cents] = fixed.split('.');
    if (cents === '00') {
      return `${Number(rupees).toLocaleString('en-US')}/=`;
    }
    return `${Number(rupees).toLocaleString('en-US')}/${cents}`;
  }

  formatCurrencyStandard(amount: number | string | undefined): string {
    const num = Number(amount ?? 0);
    return `Rs. ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  formatMonthName(periodCode: string, periodName?: string): string {
    if (periodName) return periodName;
    const parts = periodCode.split('-');
    if (parts.length === 2) {
      const year = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      if (monthNum >= 1 && monthNum <= 12) {
        return `${months[monthNum - 1]} ${year}`;
      }
    }
    return periodCode;
  }

  async generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `Invoice ${data.invoiceNumber} - ${data.buildingName}`,
          Author: 'Span Tower Management Corporation',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const leftMargin = 40;
      const rightMargin = 555;
      const tableWidth = rightMargin - leftMargin; // 515 pt
      const splitColX = 220; // dividing x coordinate between label and value

      // Apartment label formatting (e.g. "6/3" or "Tower A · Floor 1 · Unit 101")
      let aptDisplay = data.unitNumber;
      if (data.towerName) {
        aptDisplay = `${data.towerName} · Floor ${data.floor} · Unit ${data.unitNumber}`;
      } else if (data.floor) {
        aptDisplay = `Floor ${data.floor} · Unit ${data.unitNumber}`;
      }

      const monthDisplay = this.formatMonthName(data.periodCode, data.periodName);

      let y = 38;

      // ─── Header Title Box ────────────────────────────────
      // Matches: SPAN TOWER IX MANAGEMENT CORPORATION - MAINTENANCE FEE & WATER BILL
      const headerTitle = `${data.buildingName.toUpperCase()} MANAGEMENT CORPORATION - MAINTENANCE FEE & WATER BILL`;
      
      doc.rect(leftMargin, y, tableWidth, 24).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(headerTitle, leftMargin + 6, y + 7, {
        width: tableWidth - 12,
        align: 'center',
      });
      y += 24;

      // ─── Main Information Rows ───────────────────────────
      const drawTableRow = (label: string, value: string, isBoldValue = false, height = 20) => {
        doc.rect(leftMargin, y, tableWidth, height).stroke('#000000');
        // Vertical divider
        doc.moveTo(splitColX, y).lineTo(splitColX, y + height).stroke('#000000');

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
        doc.text(label, leftMargin + 8, y + (height - 9) / 2);

        doc.font(isBoldValue ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000000');
        doc.text(value, splitColX + 8, y + (height - 9) / 2, {
          width: tableWidth - (splitColX - leftMargin) - 16,
          align: 'left',
        });
        y += height;
      };

      // 1. Apartment No
      drawTableRow('Apartment No', aptDisplay);

      // 2. Month
      drawTableRow('Month', monthDisplay);

      // 3. Previous Dues
      drawTableRow('Previous Dues', this.formatSriLankanAmount(data.previousArrears));

      // 4. Maintenance Fee
      drawTableRow('Maintenance Fee', this.formatSriLankanAmount(data.maintenanceAmount), true);

      // ─── Optional: Room-by-Room Breakdown Table ───────────
      // If individual rooms are recorded for this apartment
      const roomItems = data.items.filter(
        (i) => i.itemType === 'ROOM_MAINTENANCE' || i.roomId || i.description.includes('sq. ft.')
      );

      if (roomItems.length > 0) {
        // Sub-header for rooms breakdown
        const roomHeaderHeight = 18;
        doc.rect(leftMargin, y, tableWidth, roomHeaderHeight).fill('#f1f5f9').stroke('#000000');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b');
        doc.text('ROOM PARTICULARS', leftMargin + 8, y + 5);
        doc.text('TYPE', leftMargin + 180, y + 5);
        doc.text('AREA (SQ.FT.)', leftMargin + 280, y + 5, { width: 70, align: 'right' });
        doc.text('RATE (Rs.)', leftMargin + 360, y + 5, { width: 60, align: 'right' });
        doc.text('MONTHLY CHARGE', leftMargin + 430, y + 5, { width: 75, align: 'right' });
        y += roomHeaderHeight;

        for (const r of roomItems) {
          const rowH = 16;
          doc.rect(leftMargin, y, tableWidth, rowH).stroke('#e2e8f0');
          doc.font('Helvetica').fontSize(8).fillColor('#0f172a');

          // Clean room name
          const rName = r.roomName || r.description.split('(')[0].trim() || 'Room';
          const rType = r.roomType ? r.roomType.replace(/_/g, ' ') : 'Room';

          doc.text(rName, leftMargin + 8, y + 4);
          doc.text(rType, leftMargin + 180, y + 4);
          doc.text(Number(r.quantity).toLocaleString(), leftMargin + 280, y + 4, { width: 70, align: 'right' });
          doc.text(Number(r.unitRate).toFixed(2), leftMargin + 360, y + 4, { width: 60, align: 'right' });
          doc.font('Helvetica-Bold').text(this.formatCurrencyStandard(r.amount), leftMargin + 430, y + 4, { width: 75, align: 'right' });
          y += rowH;
        }

        // Subtotal row for rooms
        const subH = 16;
        doc.rect(leftMargin, y, tableWidth, subH).fill('#f8fafc').stroke('#000000');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
        doc.text('TOTAL APARTMENT ROOM AREA & MAINTENANCE', leftMargin + 8, y + 4);
        doc.text(`${Number(data.areaSqft).toLocaleString()} sq. ft.`, leftMargin + 270, y + 4, { width: 80, align: 'right' });
        doc.text(this.formatCurrencyStandard(data.maintenanceAmount), leftMargin + 430, y + 4, { width: 75, align: 'right' });
        y += subH;
      }

      // ─── Water Bill Details Section ───────────────────────
      const sectionHeaderHeight = 18;
      doc.rect(leftMargin, y, tableWidth, sectionHeaderHeight).stroke('#000000');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
      doc.text('Water Bill Details', leftMargin + 8, y + 5);
      y += sectionHeaderHeight;

      const wr = data.waterReading;
      drawTableRow('Present Meter Reading', wr ? String(wr.currentReading) : '-');
      drawTableRow('Previous Meter Reading', wr ? String(wr.previousReading) : '-');
      drawTableRow('Units for the Month', wr ? String(wr.consumption) : '0');
      drawTableRow('Water bill for last month', this.formatSriLankanAmount(data.waterAmount));

      // ─── Additional Utility Charges (if any) ───────────────
      const otherCharges = data.items.filter(
        (i) => i.itemType !== 'MAINTENANCE' && i.itemType !== 'ROOM_MAINTENANCE' && i.itemType !== 'WATER'
      );
      if (otherCharges.length > 0) {
        doc.rect(leftMargin, y, tableWidth, sectionHeaderHeight).stroke('#000000');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
        doc.text('Other Utility Charges & Fees', leftMargin + 8, y + 5);
        y += sectionHeaderHeight;

        for (const oc of otherCharges) {
          drawTableRow(oc.description, this.formatSriLankanAmount(oc.amount));
        }
      }

      // ─── Total Dues to be Paid ────────────────────────────
      doc.rect(leftMargin, y, tableWidth, 24).stroke('#000000');
      doc.moveTo(splitColX, y).lineTo(splitColX, y + 24).stroke('#000000');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      doc.text('Total Dues to be Paid', leftMargin + 8, y + 7);
      doc.text(this.formatSriLankanAmount(data.totalDue), splitColX + 8, y + 7, {
        width: tableWidth - (splitColX - leftMargin) - 16,
        align: 'left',
      });
      y += 24;

      // ─── Bank Account Details Section ─────────────────────
      doc.rect(leftMargin, y, tableWidth, sectionHeaderHeight).stroke('#000000');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
      doc.text('Bank Account Details', leftMargin, y + 5, { width: tableWidth, align: 'center' });
      y += sectionHeaderHeight;

      const bankAccName = data.bankAccountName || `${data.buildingName} Management Corporation`;
      const bankAccNum = data.bankAccountNumber || '003660000312';
      const bankName = data.bankName || 'Sampath Bank PLC';
      const bankBranch = data.bankBranch || 'Wellawatta Branch';

      drawTableRow('Account Name', bankAccName);
      drawTableRow('Account Number', bankAccNum);
      drawTableRow('Bank', bankName);
      drawTableRow('Branch', bankBranch);

      // ─── Remittance & SGM Decision Notice Box ─────────────
      // Replicates the exact notice from Span Tower IX bill
      const noticeStartY = y + 8;
      const noticeBoxHeight = 560 - noticeStartY > 190 ? 560 - noticeStartY : 190;
      doc.rect(leftMargin, noticeStartY, tableWidth, noticeBoxHeight).stroke('#000000');

      let ny = noticeStartY + 8;
      const textPadding = leftMargin + 10;
      const textWidth = tableWidth - 20;

      // Note 1: Settle dues
      doc.font('Helvetica').fontSize(8.5).fillColor('#000000');
      doc.text(
        'Kindly settle the total dues before the end of the month to the mentioned bank account. Please ensure that you include your ',
        textPadding,
        ny,
        { width: textWidth, continued: true }
      );
      doc.font('Helvetica-Bold').text('apartment number', { continued: true });
      doc.font('Helvetica').text(' as the payment narration.');
      ny += 22;

      // Note 2: SGM decision penalty
      doc.font('Helvetica').fontSize(8.5);
      doc.text(
        'Please note that as per a decision taken at the SGM held on 2nd November 2025, a ',
        textPadding,
        ny,
        { width: textWidth, continued: true }
      );
      doc.font('Helvetica-Bold').text('15% Monthly Penalty', { continued: true });
      doc.font('Helvetica').text(
        ' will be imposed on the outstanding dues of the maintenance fees and water bills. The penalty amount will be calculated on a pro rata basis for the period that the dues are outstanding, and will be added to the following month\'s maintenance fee and water bill for settlement.'
      );
      ny += 36;

      // Note 3: Example
      doc.font('Helvetica-Bold').text('Example:', textPadding, ny);
      ny += 11;
      doc.font('Helvetica').text(
        'If the outstanding amount due is Rs 20,000/-, the monthly penalty of 15% will be Rs 3000/-. If the amount is settled in 10 days, the penalty payable will be 3000/30 x 10 = Rs 1000/-.',
        textPadding,
        ny,
        { width: textWidth }
      );
      ny += 24;

      // Note 4: Effective date
      doc.font('Helvetica').text(
        'The above decision will be implemented with effect from 1st December 2025.',
        textPadding,
        ny,
        { width: textWidth }
      );
      ny += 16;

      // Note 5: Remittance contacts
      const contactEmail = data.contactEmail || 'span.ebenezer@gmail.com';
      const contactPhone = data.contactPhone || '+94 770201034';
      const contactPerson = data.contactPerson || 'Mr. Tony David';

      doc.text(
        `After completing the payment, send the payment slip to ${contactEmail}`,
        textPadding,
        ny,
        { width: textWidth }
      );
      ny += 12;
      doc.text(
        `or WhatsApp it to ${contactPerson} (${contactPhone})`,
        textPadding,
        ny,
        { width: textWidth }
      );
      ny += 16;

      doc.font('Helvetica-Bold').text('Thank you for your cooperation.', textPadding, ny, { width: textWidth });

      doc.end();
    });
  }
}
