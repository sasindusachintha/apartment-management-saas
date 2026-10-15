import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly receiptPdfService: ReceiptPdfService,
  ) {}

  private verifyTenantAccess(user: AuthenticatedUser, organizationId: string): void {
    if (user.isPlatformAdmin) return;
    const hasMembership = user.memberships.some((m) => m.organizationId === organizationId);
    if (!hasMembership) {
      throw new NotFoundException('Resource not found');
    }
  }

  async findAll(
    user: AuthenticatedUser,
    params: {
      organizationId?: string;
      buildingId?: string;
      apartmentId?: string;
      paymentMethod?: string;
      search?: string;
    },
  ) {
    const where: Prisma.ApartmentPaymentWhereInput = {};

    if (params.organizationId) {
      this.verifyTenantAccess(user, params.organizationId);
      where.organizationId = params.organizationId;
    } else if (!user.isPlatformAdmin) {
      const authorizedOrgIds = user.memberships
        .map((m) => m.organizationId)
        .filter(Boolean) as string[];
      where.organizationId = { in: authorizedOrgIds };
    }

    if (params.buildingId) where.buildingId = params.buildingId;
    if (params.apartmentId) where.apartmentId = params.apartmentId;
    if (params.paymentMethod) where.paymentMethod = params.paymentMethod as any;

    if (params.search) {
      const term = params.search.trim();
      where.OR = [
        { receiptNumber: { contains: term } },
        { paymentReference: { contains: term } },
        { apartment: { unitNumber: { contains: term } } },
        { apartment: { ownerName: { contains: term } } },
        { apartment: { residentName: { contains: term } } },
      ];
    }

    return this.prisma.apartmentPayment.findMany({
      where,
      include: {
        apartment: { select: { id: true, unitNumber: true, floor: true, ownerName: true, residentName: true } },
        building: { select: { id: true, name: true } },
        recordedByUser: { select: { id: true, name: true } },
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, periodCode: true, totalDue: true, balanceDue: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const payment = await this.prisma.apartmentPayment.findUnique({
      where: { id },
      include: {
        apartment: true,
        building: true,
        recordedByUser: { select: { id: true, name: true, email: true } },
        allocations: {
          include: {
            invoice: {
              include: {
                billingPeriod: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    this.verifyTenantAccess(user, payment.organizationId);

    return payment;
  }

  async recordPayment(dto: RecordPaymentDto, user: AuthenticatedUser) {
    // Verify apartment exists
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: dto.apartmentId },
      include: { building: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    const organizationId = dto.organizationId || apartment.organizationId;
    const buildingId = dto.buildingId || apartment.buildingId;

    this.verifyTenantAccess(user, organizationId);

    // Check duplicate payment reference in organization
    const existingRef = await this.prisma.apartmentPayment.findUnique({
      where: {
        organizationId_paymentReference: {
          organizationId,
          paymentReference: dto.paymentReference.trim(),
        },
      },
    });

    if (existingRef) {
      throw new ConflictException(
        `Payment with reference "${dto.paymentReference}" has already been recorded for this organization on ${new Date(existingRef.paymentDate).toLocaleDateString()}. Duplicate payments are prevented.`,
      );
    }

    const payAmount = new Prisma.Decimal(dto.amount);
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    // Check online payment provider interface
    const isOnline = dto.paymentMethod === 'ONLINE' || dto.isOnline === true;
    let paymentStatus: any = 'COMPLETED';
    let gatewayStatus: string | null = null;

    if (isOnline) {
      // Prompt requirement: "Do not pretend an online payment is successful without verified payment-provider confirmation.
      // Implement a provider-independent payment interface and clearly mark online payment integration as pending if credentials are unavailable."
      paymentStatus = 'PENDING';
      gatewayStatus = 'GATEWAY_CREDENTIALS_PENDING_INTEGRATION';
    }

    // Generate Unique Receipt Number: REC-BLDG-YYYYMM-SEQ
    const nowStr = paymentDate.toISOString().slice(0, 7).replace('-', '');
    const cleanBldg = apartment.building.name
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 4)
      .toUpperCase();
    const count = await this.prisma.apartmentPayment.count({
      where: { organizationId },
    });
    const seq = (count + 1).toString().padStart(4, '0');
    const receiptNumber = `REC-${cleanBldg}-${nowStr}-${seq}`;

    // Execute in Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.apartmentPayment.create({
        data: {
          organizationId,
          buildingId,
          apartmentId: dto.apartmentId,
          receiptNumber,
          amount: payAmount,
          paymentMethod: dto.paymentMethod,
          paymentReference: dto.paymentReference.trim(),
          paymentDate,
          recordedByUserId: user.id,
          status: paymentStatus,
          notes: dto.notes ?? null,
          isOnline,
          gatewayStatus,
        },
      });

      // If online and pending, do not allocate until verified confirmation
      if (isOnline && paymentStatus === 'PENDING') {
        return payment;
      }

      // Invoice Allocation Logic
      if (dto.allocations && dto.allocations.length > 0) {
        // Explicit Allocations
        for (const alloc of dto.allocations) {
          const allocDecimal = new Prisma.Decimal(alloc.amount);
          const invoice = await tx.apartmentInvoice.findUnique({
            where: { id: alloc.invoiceId },
          });

          if (!invoice || invoice.apartmentId !== dto.apartmentId) {
            throw new BadRequestException(`Invoice ${alloc.invoiceId} does not belong to apartment`);
          }

          const newPaid = invoice.paidAmount.plus(allocDecimal);
          const newBal = invoice.totalDue.minus(newPaid);
          const newStatus = newBal.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIALLY_PAID';

          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              invoiceId: alloc.invoiceId,
              amount: allocDecimal,
            },
          });

          await tx.apartmentInvoice.update({
            where: { id: alloc.invoiceId },
            data: {
              paidAmount: newPaid,
              balanceDue: newBal,
              status: newStatus,
            },
          });
        }
      } else {
        // Auto FIFO Allocation (oldest outstanding bills first)
        const openInvoices = await tx.apartmentInvoice.findMany({
          where: {
            apartmentId: dto.apartmentId,
            status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          },
          orderBy: { issueDate: 'asc' },
        });

        let remaining = payAmount;

        for (const invoice of openInvoices) {
          if (remaining.lessThanOrEqualTo(0)) break;

          const toAllocate = Prisma.Decimal.min(remaining, invoice.balanceDue);
          const newPaid = invoice.paidAmount.plus(toAllocate);
          const newBal = invoice.totalDue.minus(newPaid);
          const newStatus = newBal.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIALLY_PAID';

          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              invoiceId: invoice.id,
              amount: toAllocate,
            },
          });

          await tx.apartmentInvoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaid,
              balanceDue: newBal,
              status: newStatus,
            },
          });

          remaining = remaining.minus(toAllocate);
        }
      }

      return payment;
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: 'PAYMENT_RECORDED',
      entityType: 'ApartmentPayment',
      entityId: result.id,
      metadata: {
        receiptNumber: result.receiptNumber,
        amount: dto.amount,
        reference: dto.paymentReference,
        method: dto.paymentMethod,
        apartmentId: dto.apartmentId,
      },
    });

    return this.findOne(result.id, user);
  }

  async getPdfBuffer(paymentId: string, user: AuthenticatedUser): Promise<Buffer> {
    const payment = await this.findOne(paymentId, user);

    return this.receiptPdfService.generateReceiptPdf({
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate,
      amount: payment.amount.toNumber(),
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference,
      status: payment.status,
      notes: payment.notes,
      buildingName: payment.building.name,
      buildingAddress: payment.building.address,
      unitNumber: payment.apartment.unitNumber,
      floor: payment.apartment.floor,
      ownerName: payment.apartment.ownerName,
      residentName: payment.apartment.residentName,
      recordedByName: payment.recordedByUser?.name,
      allocations: payment.allocations.map((a) => ({
        invoiceNumber: a.invoice.invoiceNumber,
        periodCode: a.invoice.periodCode,
        allocatedAmount: a.amount.toNumber(),
        totalDue: a.invoice.totalDue.toNumber(),
        balanceDue: a.invoice.balanceDue.toNumber(),
      })),
    });
  }

  async getArrearsSummary(
    user: AuthenticatedUser,
    params: { organizationId?: string; buildingId?: string },
  ) {
    const where: Prisma.ApartmentInvoiceWhereInput = {};

    if (params.organizationId) {
      this.verifyTenantAccess(user, params.organizationId);
      where.organizationId = params.organizationId;
    } else if (!user.isPlatformAdmin) {
      const authorizedOrgIds = user.memberships
        .map((m) => m.organizationId)
        .filter(Boolean) as string[];
      where.organizationId = { in: authorizedOrgIds };
    }

    if (params.buildingId) {
      where.buildingId = params.buildingId;
    }

    const invoices = await this.prisma.apartmentInvoice.findMany({
      where: {
        ...where,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'] },
      },
      include: {
        apartment: { select: { id: true, unitNumber: true, floor: true, ownerName: true, residentName: true } },
        building: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    let totalBilled = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let outstandingArrears = new Prisma.Decimal(0);
    let overdueTotal = new Prisma.Decimal(0);
    let overdueCount = 0;

    const apartmentArrearsMap = new Map<string, {
      apartmentId: string;
      unitNumber: string;
      buildingName: string;
      ownerName: string | null;
      residentName: string | null;
      balanceDue: Prisma.Decimal;
      overdueInvoices: number;
    }>();

    for (const inv of invoices) {
      totalBilled = totalBilled.plus(inv.currentChargesTotal);
      totalCollected = totalCollected.plus(inv.paidAmount);

      if (inv.balanceDue.greaterThan(0)) {
        outstandingArrears = outstandingArrears.plus(inv.balanceDue);

        const isOverdue = inv.dueDate < now;
        if (isOverdue) {
          overdueTotal = overdueTotal.plus(inv.balanceDue);
          overdueCount++;
        }

        const currentApt = apartmentArrearsMap.get(inv.apartmentId) || {
          apartmentId: inv.apartmentId,
          unitNumber: inv.apartment.unitNumber,
          buildingName: inv.building.name,
          ownerName: inv.apartment.ownerName,
          residentName: inv.apartment.residentName,
          balanceDue: new Prisma.Decimal(0),
          overdueInvoices: 0,
        };

        currentApt.balanceDue = currentApt.balanceDue.plus(inv.balanceDue);
        if (isOverdue) currentApt.overdueInvoices++;
        apartmentArrearsMap.set(inv.apartmentId, currentApt);
      }
    }

    const collectionRate = totalBilled.greaterThan(0)
      ? totalCollected.dividedBy(totalBilled).times(100).toNumber()
      : 100.0;

    return {
      totalBilled: totalBilled.toNumber(),
      totalCollected: totalCollected.toNumber(),
      outstandingArrears: outstandingArrears.toNumber(),
      overdueTotal: overdueTotal.toNumber(),
      overdueCount,
      collectionRate: Math.min(100, Math.round(collectionRate * 100) / 100),
      apartmentsWithArrears: Array.from(apartmentArrearsMap.values()).map((a) => ({
        ...a,
        balanceDue: a.balanceDue.toNumber(),
      })),
    };
  }
}
