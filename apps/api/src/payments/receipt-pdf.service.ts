import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface ReceiptPdfData {
  receiptNumber: string;
  paymentDate: Date | string;
  amount: number | string;
  paymentMethod: string;
  paymentReference: string;
  status: string;
  notes?: string | null;
  buildingName: string;
  buildingAddress: string;
  unitNumber: string;
  floor: number;
  ownerName?: string | null;
  residentName?: string | null;
  recordedByName?: string | null;
  allocations: Array<{
    invoiceNumber: string;
    periodCode: string;
    allocatedAmount: number | string;
    totalDue: number | string;
    balanceDue: number | string;
  }>;
}

@Injectable()
export class ReceiptPdfService {
  formatCurrency(amount: number | string | undefined): string {
    const num = Number(amount ?? 0);
    return `Rs. ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    return new Date(date).toISOString().split('T')[0];
  }

  async generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A5',
        layout: 'landscape',
        margin: 30,
        info: {
          Title: `Receipt ${data.receiptNumber}`,
          Author: 'ApartmentSaaS',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#065f46'; // Emerald Green
      const darkColor = '#0f172a';
      const grayColor = '#475569';
      const lightBg = '#f0fdf4';
      const borderColor = '#cbd5e1';

      // Header Box
      doc.rect(30, 30, 535, 50).fill(lightBg);
      doc.rect(30, 30, 535, 50).stroke(borderColor);

      doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold');
      doc.text(`MANAGEMENT CORPORATION - ${data.buildingName.toUpperCase()}`, 45, 40);
      doc.fontSize(8).fillColor(grayColor).font('Helvetica');
      doc.text(data.buildingAddress, 45, 58);

      doc.fontSize(13).fillColor(primaryColor).font('Helvetica-Bold');
      doc.text('OFFICIAL PAYMENT RECEIPT', 350, 40, { align: 'right' });
      doc.fontSize(8).fillColor(grayColor).font('Helvetica');
      doc.text(`Status: ${data.status}`, 350, 58, { align: 'right' });

      // Receipt Meta
      let y = 90;
      doc.rect(30, y, 535, 60).stroke(borderColor);

      doc.fontSize(9).fillColor(darkColor).font('Helvetica-Bold');
      doc.text('Receipt No:', 45, y + 10);
      doc.font('Helvetica').text(data.receiptNumber, 120, y + 10);

      doc.font('Helvetica-Bold').text('Date Received:', 45, y + 25);
      doc.font('Helvetica').text(this.formatDate(data.paymentDate), 120, y + 25);

      doc.font('Helvetica-Bold').text('Apartment:', 45, y + 40);
      doc.font('Helvetica').text(`${data.unitNumber} (Floor ${data.floor})`, 120, y + 40);

      doc.font('Helvetica-Bold').text('Payment Method:', 280, y + 10);
      doc.font('Helvetica').text(data.paymentMethod.replace('_', ' '), 370, y + 10);

      doc.font('Helvetica-Bold').text('Reference / Cheque:', 280, y + 25);
      doc.font('Helvetica').text(data.paymentReference, 370, y + 25);

      doc.font('Helvetica-Bold').text('Payer / Resident:', 280, y + 40);
      doc.font('Helvetica').text(data.residentName || data.ownerName || '-', 370, y + 40);

      // Amount Banner
      y = 160;
      doc.rect(30, y, 535, 30).fill(primaryColor);
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('AMOUNT RECEIVED IN FULL & FINAL ACKNOWLEDGMENT:', 45, y + 10);
      doc.fontSize(12).text(this.formatCurrency(data.amount), 350, y + 9, { align: 'right' });

      // Allocations Table
      y = 200;
      doc.rect(30, y, 535, 18).fill('#f1f5f9');
      doc.fontSize(8).fillColor(darkColor).font('Helvetica-Bold');
      doc.text('INVOICE ALLOCATION BREAKDOWN', 45, y + 5);
      doc.text('PERIOD', 200, y + 5);
      doc.text('TOTAL DUE', 290, y + 5, { width: 70, align: 'right' });
      doc.text('AMOUNT ALLOCATED', 370, y + 5, { width: 90, align: 'right' });
      doc.text('REMAINING BALANCE', 465, y + 5, { width: 90, align: 'right' });

      y += 18;
      if (data.allocations && data.allocations.length > 0) {
        for (const alloc of data.allocations) {
          doc.rect(30, y, 535, 18).stroke(borderColor);
          doc.fontSize(8).fillColor(darkColor).font('Helvetica');
          doc.text(alloc.invoiceNumber, 45, y + 5);
          doc.text(alloc.periodCode, 200, y + 5);
          doc.text(this.formatCurrency(alloc.totalDue), 290, y + 5, { width: 70, align: 'right' });
          doc.font('Helvetica-Bold').fillColor(primaryColor).text(this.formatCurrency(alloc.allocatedAmount), 370, y + 5, { width: 90, align: 'right' });
          doc.font('Helvetica-Bold').fillColor('#b91c1c').text(this.formatCurrency(alloc.balanceDue), 465, y + 5, { width: 90, align: 'right' });
          y += 18;
        }
      } else {
        doc.rect(30, y, 535, 18).stroke(borderColor);
        doc.fontSize(8).fillColor(grayColor).font('Helvetica');
        doc.text('Unallocated Credit on Account', 45, y + 5);
        doc.text(this.formatCurrency(data.amount), 370, y + 5, { width: 90, align: 'right' });
        y += 18;
      }

      // Footer & Signature
      y += 20;
      doc.fontSize(8).fillColor(darkColor).font('Helvetica-Bold');
      doc.text('Entered / Handled By:', 45, y);
      doc.font('Helvetica').text(data.recordedByName || 'Staff Member', 145, y);

      doc.text('Authorized Signature & Seal:', 360, y);
      doc.moveTo(360, y + 25).lineTo(520, y + 25).stroke(borderColor);

      doc.fontSize(7).fillColor(grayColor).font('Helvetica');
      doc.text(
        'Thank you for your prompt remittance. Please preserve this receipt for your records.',
        30,
        380,
        { align: 'center', width: 535 },
      );

      doc.end();
    });
  }
}
