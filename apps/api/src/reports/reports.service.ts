import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private verifyTenantAccess(user: AuthenticatedUser, organizationId: string): void {
    if (user.isPlatformAdmin) return;
    const hasMembership = user.memberships.some((m) => m.organizationId === organizationId);
    if (!hasMembership) {
      throw new NotFoundException('Resource not found');
    }
  }

  async getCollectionReport(
    user: AuthenticatedUser,
    params: { organizationId?: string; buildingId?: string; periodCode?: string },
  ) {
    if (params.organizationId) {
      this.verifyTenantAccess(user, params.organizationId);
    }

    const invoiceWhere: Prisma.ApartmentInvoiceWhereInput = {};
    const paymentWhere: Prisma.ApartmentPaymentWhereInput = { status: 'COMPLETED' };

    if (params.organizationId) {
      invoiceWhere.organizationId = params.organizationId;
      paymentWhere.organizationId = params.organizationId;
    }
    if (params.buildingId) {
      invoiceWhere.buildingId = params.buildingId;
      paymentWhere.buildingId = params.buildingId;
    }
    if (params.periodCode) {
      invoiceWhere.periodCode = params.periodCode;
    }

    const invoices = await this.prisma.apartmentInvoice.findMany({
      where: invoiceWhere,
      include: {
        apartment: { select: { unitNumber: true, floor: true, ownerName: true } },
        building: { select: { name: true } },
      },
    });

    const payments = await this.prisma.apartmentPayment.findMany({
      where: paymentWhere,
      include: {
        apartment: { select: { unitNumber: true, ownerName: true } },
        building: { select: { name: true } },
        recordedByUser: { select: { name: true } },
      },
    });

    let totalBilled = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let totalMaintenance = new Prisma.Decimal(0);
    let totalWater = new Prisma.Decimal(0);
    let totalOther = new Prisma.Decimal(0);

    for (const inv of invoices) {
      totalBilled = totalBilled.plus(inv.currentChargesTotal);
      totalMaintenance = totalMaintenance.plus(inv.maintenanceAmount);
      totalWater = totalWater.plus(inv.waterAmount);
      totalOther = totalOther.plus(inv.otherChargesAmount);
    }

    const paymentMethodBreakdown: Record<string, number> = {
      CASH: 0,
      BANK_TRANSFER: 0,
      CHEQUE: 0,
      ONLINE: 0,
    };

    for (const p of payments) {
      const amt = p.amount.toNumber();
      totalCollected = totalCollected.plus(p.amount);
      paymentMethodBreakdown[p.paymentMethod] =
        (paymentMethodBreakdown[p.paymentMethod] || 0) + amt;
    }

    const collectionRate = totalBilled.greaterThan(0)
      ? totalCollected.dividedBy(totalBilled).times(100).toNumber()
      : 100.0;

    return {
      periodCode: params.periodCode || 'ALL',
      totalBilled: totalBilled.toNumber(),
      totalCollected: totalCollected.toNumber(),
      collectionRate: Math.min(100, Math.round(collectionRate * 100) / 100),
      breakdown: {
        maintenance: totalMaintenance.toNumber(),
        water: totalWater.toNumber(),
        other: totalOther.toNumber(),
      },
      paymentMethods: paymentMethodBreakdown,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
    };
  }

  async getArrearsReport(
    user: AuthenticatedUser,
    params: { organizationId?: string; buildingId?: string },
  ) {
    if (params.organizationId) {
      this.verifyTenantAccess(user, params.organizationId);
    }

    const where: Prisma.ApartmentInvoiceWhereInput = {
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
    };

    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.buildingId) where.buildingId = params.buildingId;

    const invoices = await this.prisma.apartmentInvoice.findMany({
      where,
      include: {
        apartment: true,
        building: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const map = new Map<string, any>();

    for (const inv of invoices) {
      const isOverdue = inv.dueDate < now;
      const daysOverdue = isOverdue
        ? Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const apt = map.get(inv.apartmentId) || {
        apartmentId: inv.apartmentId,
        unitNumber: inv.apartment.unitNumber,
        floor: inv.apartment.floor,
        buildingName: inv.building.name,
        ownerName: inv.apartment.ownerName,
        ownerPhone: inv.apartment.ownerPhone,
        ownerEmail: inv.apartment.ownerEmail,
        residentName: inv.apartment.residentName,
        totalArrears: 0,
        oldestDueDate: inv.dueDate,
        maxDaysOverdue: 0,
        invoices: [],
      };

      apt.totalArrears += inv.balanceDue.toNumber();
      if (daysOverdue > apt.maxDaysOverdue) {
        apt.maxDaysOverdue = daysOverdue;
      }
      apt.invoices.push({
        invoiceNumber: inv.invoiceNumber,
        periodCode: inv.periodCode,
        totalDue: inv.totalDue.toNumber(),
        paidAmount: inv.paidAmount.toNumber(),
        balanceDue: inv.balanceDue.toNumber(),
        dueDate: inv.dueDate,
        isOverdue,
        daysOverdue,
      });

      map.set(inv.apartmentId, apt);
    }

    const list = Array.from(map.values()).sort((a, b) => b.totalArrears - a.totalArrears);
    const grandTotal = list.reduce((sum, item) => sum + item.totalArrears, 0);

    return {
      totalArrearsAmount: grandTotal,
      apartmentsCount: list.length,
      records: list,
    };
  }

  async getApartmentStatement(apartmentId: string, user: AuthenticatedUser) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        building: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    this.verifyTenantAccess(user, apartment.organizationId);

    const invoices = await this.prisma.apartmentInvoice.findMany({
      where: { apartmentId },
      include: {
        items: true,
        adjustments: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    const payments = await this.prisma.apartmentPayment.findMany({
      where: { apartmentId, status: 'COMPLETED' },
      include: {
        recordedByUser: { select: { name: true } },
      },
      orderBy: { paymentDate: 'asc' },
    });

    // Create a chronological financial ledger
    type LedgerEntry = {
      date: Date;
      type: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    };

    const ledger: LedgerEntry[] = [];
    let runningBalance = 0;

    const events: Array<{
      date: Date;
      type: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT';
      ref: string;
      desc: string;
      debit: number;
      credit: number;
    }> = [];

    for (const inv of invoices) {
      events.push({
        date: inv.issueDate,
        type: 'INVOICE',
        ref: inv.invoiceNumber,
        desc: `Maintenance & Utilities (${inv.periodCode})`,
        debit: inv.currentChargesTotal.toNumber(),
        credit: 0,
      });

      for (const adj of inv.adjustments) {
        const isCredit = adj.adjustmentType === 'CREDIT' || adj.adjustmentType === 'WAIVER';
        events.push({
          date: adj.createdAt,
          type: 'ADJUSTMENT',
          ref: `ADJ-${inv.invoiceNumber}`,
          desc: `Adjustment [${adj.adjustmentType}]: ${adj.reason}`,
          debit: isCredit ? 0 : adj.amount.toNumber(),
          credit: isCredit ? adj.amount.toNumber() : 0,
        });
      }
    }

    for (const p of payments) {
      events.push({
        date: p.paymentDate,
        type: 'PAYMENT',
        ref: p.receiptNumber,
        desc: `Payment (${p.paymentMethod.replace('_', ' ')}) - Ref: ${p.paymentReference}`,
        debit: 0,
        credit: p.amount.toNumber(),
      });
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const ev of events) {
      runningBalance += ev.debit - ev.credit;
      ledger.push({
        date: ev.date,
        type: ev.type,
        reference: ev.ref,
        description: ev.desc,
        debit: ev.debit,
        credit: ev.credit,
        balance: Math.round(runningBalance * 100) / 100,
      });
    }

    return {
      apartment: {
        id: apartment.id,
        unitNumber: apartment.unitNumber,
        floor: apartment.floor,
        areaSqft: apartment.areaSqft.toNumber(),
        ownerName: apartment.ownerName,
        residentName: apartment.residentName,
        buildingName: apartment.building.name,
      },
      currentOutstandingBalance: Math.round(runningBalance * 100) / 100,
      ledger,
    };
  }

  async getPaymentReport(
    user: AuthenticatedUser,
    params: {
      organizationId?: string;
      buildingId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    if (params.organizationId) {
      this.verifyTenantAccess(user, params.organizationId);
    }

    const where: Prisma.ApartmentPaymentWhereInput = {};

    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.buildingId) where.buildingId = params.buildingId;

    if (params.startDate || params.endDate) {
      where.paymentDate = {};
      if (params.startDate) where.paymentDate.gte = new Date(params.startDate);
      if (params.endDate) where.paymentDate.lte = new Date(params.endDate);
    }

    const payments = await this.prisma.apartmentPayment.findMany({
      where,
      include: {
        apartment: { select: { unitNumber: true, floor: true, ownerName: true } },
        building: { select: { name: true } },
        recordedByUser: { select: { name: true } },
        allocations: {
          include: { invoice: { select: { invoiceNumber: true, periodCode: true } } },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    const totalCollected = payments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount.toNumber(), 0);

    return {
      totalCollected,
      count: payments.length,
      payments,
    };
  }
}
