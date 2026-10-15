import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApartmentInvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InvoicePdfService } from './invoice-pdf.service';
import {
  BulkGenerateInvoicesDto,
  CreateAdjustmentDto,
  CreateBillingPeriodDto,
  FinalizeInvoicesDto,
  GenerateInvoiceDto,
  SaveBillingSettingDto,
} from './dto/billing.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  private verifyTenantAccess(user: AuthenticatedUser, organizationId: string): void {
    if (user.isPlatformAdmin) return;
    const hasMembership = user.memberships.some((m) => m.organizationId === organizationId);
    if (!hasMembership) {
      throw new NotFoundException('Resource not found');
    }
  }

  // ─────────────────────────────────────────────
  // Billing Settings
  // ─────────────────────────────────────────────

  async getSetting(buildingId: string, user: AuthenticatedUser) {
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
      include: { billingSettings: true },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    this.verifyTenantAccess(user, building.organizationId);

    if (building.billingSettings.length > 0) {
      return building.billingSettings[0];
    }

    // Default template
    return {
      organizationId: building.organizationId,
      buildingId,
      maintenanceRatePerSqft: new Prisma.Decimal(10.0),
      defaultDueDays: 15,
      latePaymentPenaltyPercent: new Prisma.Decimal(0.0),
      latePaymentGraceDays: 5,
      waterTariffPerUnit: new Prisma.Decimal(100.0),
      waterFixedCharge: new Prisma.Decimal(0.0),
      bankName: 'Commercial Bank of Ceylon',
      bankAccountName: `Management Corporation - ${building.name}`,
      bankAccountNumber: '',
      bankBranch: '',
      paymentInstructions: '',
    };
  }

  async saveSetting(dto: SaveBillingSettingDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    const setting = await this.prisma.billingSetting.upsert({
      where: { buildingId: dto.buildingId },
      update: {
        maintenanceRatePerSqft: new Prisma.Decimal(dto.maintenanceRatePerSqft),
        defaultDueDays: dto.defaultDueDays ?? 15,
        latePaymentPenaltyPercent: new Prisma.Decimal(dto.latePaymentPenaltyPercent ?? 0),
        latePaymentGraceDays: dto.latePaymentGraceDays ?? 5,
        waterTariffPerUnit: new Prisma.Decimal(dto.waterTariffPerUnit ?? 100),
        waterFixedCharge: new Prisma.Decimal(dto.waterFixedCharge ?? 0),
        bankName: dto.bankName ?? null,
        bankAccountName: dto.bankAccountName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        bankBranch: dto.bankBranch ?? null,
        paymentInstructions: dto.paymentInstructions ?? null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        contactPerson: dto.contactPerson ?? null,
        noticeText: dto.noticeText ?? null,
      },
      create: {
        organizationId: dto.organizationId,
        buildingId: dto.buildingId,
        maintenanceRatePerSqft: new Prisma.Decimal(dto.maintenanceRatePerSqft),
        defaultDueDays: dto.defaultDueDays ?? 15,
        latePaymentPenaltyPercent: new Prisma.Decimal(dto.latePaymentPenaltyPercent ?? 0),
        latePaymentGraceDays: dto.latePaymentGraceDays ?? 5,
        waterTariffPerUnit: new Prisma.Decimal(dto.waterTariffPerUnit ?? 100),
        waterFixedCharge: new Prisma.Decimal(dto.waterFixedCharge ?? 0),
        bankName: dto.bankName ?? null,
        bankAccountName: dto.bankAccountName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        bankBranch: dto.bankBranch ?? null,
        paymentInstructions: dto.paymentInstructions ?? null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        contactPerson: dto.contactPerson ?? null,
        noticeText: dto.noticeText ?? null,
      },
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'BILLING_SETTING_UPDATED',
      entityType: 'BillingSetting',
      entityId: setting.id,
      metadata: { buildingId: dto.buildingId, rate: dto.maintenanceRatePerSqft },
    });

    return setting;
  }

  // ─────────────────────────────────────────────
  // Billing Periods
  // ─────────────────────────────────────────────

  async findAllPeriods(user: AuthenticatedUser, buildingId?: string) {
    const where: Prisma.BillingPeriodWhereInput = {};
    if (buildingId) {
      const b = await this.prisma.building.findUnique({ where: { id: buildingId } });
      if (b) {
        this.verifyTenantAccess(user, b.organizationId);
        where.buildingId = buildingId;
      }
    } else if (!user.isPlatformAdmin) {
      const authorizedOrgIds = user.memberships
        .map((m) => m.organizationId)
        .filter(Boolean) as string[];
      where.organizationId = { in: authorizedOrgIds };
    }

    return this.prisma.billingPeriod.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        _count: { select: { invoices: true } },
      },
      orderBy: { periodCode: 'desc' },
    });
  }

  async createPeriod(dto: CreateBillingPeriodDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    const existing = await this.prisma.billingPeriod.findUnique({
      where: {
        buildingId_periodCode: {
          buildingId: dto.buildingId,
          periodCode: dto.periodCode,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Billing period ${dto.periodCode} already exists for this building`);
    }

    const period = await this.prisma.billingPeriod.create({
      data: {
        organizationId: dto.organizationId,
        buildingId: dto.buildingId,
        name: dto.name,
        periodCode: dto.periodCode,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        dueDate: new Date(dto.dueDate),
        isClosed: false,
      },
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'BILLING_PERIOD_CREATED',
      entityType: 'BillingPeriod',
      entityId: period.id,
      metadata: { periodCode: period.periodCode, buildingId: period.buildingId },
    });

    return period;
  }

  // ─────────────────────────────────────────────
  // Invoices & Billing Engine
  // ─────────────────────────────────────────────

  async findAllInvoices(
    user: AuthenticatedUser,
    params: {
      organizationId?: string;
      buildingId?: string;
      apartmentId?: string;
      periodCode?: string;
      status?: string;
      search?: string;
    },
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

    if (params.buildingId) where.buildingId = params.buildingId;
    if (params.apartmentId) where.apartmentId = params.apartmentId;
    if (params.periodCode) where.periodCode = params.periodCode;
    if (params.status) where.status = params.status as any;

    if (params.search) {
      const term = params.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term } },
        { apartment: { unitNumber: { contains: term } } },
        { apartment: { ownerName: { contains: term } } },
        { apartment: { residentName: { contains: term } } },
        { apartment: { owner: { name: { contains: term } } } },
        { apartment: { resident: { name: { contains: term } } } },
      ];
    }

    return this.prisma.apartmentInvoice.findMany({
      where,
      include: {
        apartment: { select: { id: true, unitNumber: true, floor: true, ownerName: true, residentName: true, areaSqft: true, tower: { select: { id: true, name: true } } } },
        building: { select: { id: true, name: true } },
        billingPeriod: { select: { id: true, name: true, periodCode: true } },
      },
      orderBy: [{ issueDate: 'desc' }, { apartment: { unitNumber: 'asc' } }],
    });
  }

  async findOneInvoice(id: string, user: AuthenticatedUser) {
    const invoice = await this.prisma.apartmentInvoice.findUnique({
      where: { id },
      include: {
        apartment: {
          include: {
            tower: true,
            rooms: { where: { isActive: true } },
          },
        },
        building: {
          include: { billingSettings: true },
        },
        billingPeriod: true,
        items: {
          include: { room: true },
        },
        allocations: {
          include: { payment: true },
        },
        adjustments: {
          include: { authorizedByUser: { select: { id: true, name: true } } },
        },
        finalizedByUser: { select: { id: true, name: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    this.verifyTenantAccess(user, invoice.organizationId);

    // Fetch corresponding water reading if exists
    const waterReading = await this.prisma.waterReading.findUnique({
      where: {
        apartmentId_periodCode: {
          apartmentId: invoice.apartmentId,
          periodCode: invoice.periodCode,
        },
      },
    });

    return {
      ...invoice,
      waterReading,
    };
  }

  async generateInvoice(dto: GenerateInvoiceDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    // Check duplicate invoice
    const existing = await this.prisma.apartmentInvoice.findUnique({
      where: {
        apartmentId_periodCode: {
          apartmentId: dto.apartmentId,
          periodCode: dto.periodCode,
        },
      },
      include: { items: true },
    });

    if (existing) {
      if (existing.status !== 'DRAFT') {
        throw new ConflictException(
          `Invoice ${existing.invoiceNumber} for apartment and period ${dto.periodCode} has already been finalized (${existing.status}). Adjustments must be recorded instead.`,
        );
      }
      // If it is in DRAFT, delete existing draft items so it can be recalculated cleanly
      await this.prisma.invoiceItem.deleteMany({
        where: { invoiceId: existing.id },
      });
    }

    // Load Apartment & Building Details (including Tower and Rooms)
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        id: dto.apartmentId,
        organizationId: dto.organizationId,
        buildingId: dto.buildingId,
      },
      include: {
        building: {
          include: { billingSettings: true },
        },
        tower: true,
        rooms: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    const buildingSetting = apartment.building.billingSettings[0];
    const defaultRate =
      dto.maintenanceRateOverride !== undefined
        ? new Prisma.Decimal(dto.maintenanceRateOverride)
        : buildingSetting
          ? buildingSetting.maintenanceRatePerSqft
          : new Prisma.Decimal(10.0);

    let maintenanceAmount = new Prisma.Decimal(0.0);
    let calculatedArea = apartment.areaSqft;

    const lineItemsToCreate: Array<{
      itemType: any;
      description: string;
      quantity: Prisma.Decimal;
      unitRate: Prisma.Decimal;
      amount: Prisma.Decimal;
      roomId?: string;
      roomName?: string;
      roomType?: any;
    }> = [];

    // Individual Room-Based Calculation (if active rooms configured)
    const activeRooms = apartment.rooms?.filter((r) => r.isActive) ?? [];
    if (activeRooms.length > 0) {
      // 1. Total apartment area = Sum of all applicable room areas
      calculatedArea = activeRooms.reduce((sum, r) => sum.plus(r.areaSqft), new Prisma.Decimal(0));

      // 2. Room maintenance charge = Room area × Applicable rate per square foot
      // 3. Total apartment maintenance charge = Sum of all room maintenance charges
      for (const room of activeRooms) {
        const applicableRate = room.maintenanceRate !== null && room.maintenanceRate !== undefined
          ? room.maintenanceRate
          : defaultRate;
        const roomCharge = room.areaSqft.times(applicableRate);
        maintenanceAmount = maintenanceAmount.plus(roomCharge);

        const typeLabel = room.roomType ? room.roomType.replace(/_/g, ' ') : 'Room';
        lineItemsToCreate.push({
          itemType: 'ROOM_MAINTENANCE' as any,
          description: `${room.roomNumber} (${typeLabel}) — ${room.areaSqft} sq. ft. @ Rs. ${applicableRate}/sq ft`,
          quantity: room.areaSqft,
          unitRate: applicableRate,
          amount: roomCharge,
          roomId: room.id,
          roomName: room.roomNumber,
          roomType: room.roomType,
        });
      }
    } else {
      // Backwards-compatible fallback: existing apartments without room records continue to work
      maintenanceAmount = apartment.areaSqft.times(defaultRate);
      calculatedArea = apartment.areaSqft;
      lineItemsToCreate.push({
        itemType: 'MAINTENANCE',
        description: `Monthly Maintenance Fee (${apartment.areaSqft} sq ft @ Rs. ${defaultRate}/sq ft)`,
        quantity: apartment.areaSqft,
        unitRate: defaultRate,
        amount: maintenanceAmount,
      });
    }

    const maintenanceRate = defaultRate;

    // Water Utility calculation
    let waterAmount = new Prisma.Decimal(0.0);
    if (dto.includeWater !== false) {
      const waterReading = await this.prisma.waterReading.findUnique({
        where: {
          apartmentId_periodCode: {
            apartmentId: dto.apartmentId,
            periodCode: dto.periodCode,
          },
        },
      });

      if (waterReading) {
        waterAmount = waterReading.totalAmount;
        lineItemsToCreate.push({
          itemType: 'WATER',
          description: `Water Consumption (${waterReading.consumption} units @ Rs. ${waterReading.ratePerUnit}/unit + fixed Rs. ${waterReading.fixedCharge})`,
          quantity: waterReading.consumption,
          unitRate: waterReading.ratePerUnit,
          amount: waterReading.totalAmount,
        });
      }
    }

    // Additional Charges calculation
    let otherChargesAmount = new Prisma.Decimal(0.0);
    if (dto.additionalCharges && dto.additionalCharges.length > 0) {
      for (const item of dto.additionalCharges) {
        const itemAmt = new Prisma.Decimal(item.amount);
        otherChargesAmount = otherChargesAmount.plus(itemAmt);
        lineItemsToCreate.push({
          itemType: item.itemType,
          description: item.description,
          quantity: new Prisma.Decimal(item.quantity ?? 1),
          unitRate: new Prisma.Decimal(item.unitRate),
          amount: itemAmt,
        });
      }
    }

    const penaltyAmount = new Prisma.Decimal(dto.penaltyAmount ?? 0);
    if (penaltyAmount.greaterThan(0)) {
      lineItemsToCreate.push({
        itemType: 'PENALTY',
        description: 'Late Payment Penalty / Surcharge',
        quantity: new Prisma.Decimal(1),
        unitRate: penaltyAmount,
        amount: penaltyAmount,
      });
    }

    const discountAmount = new Prisma.Decimal(dto.discountAmount ?? 0);
    if (discountAmount.greaterThan(0)) {
      lineItemsToCreate.push({
        itemType: 'DISCOUNT',
        description: 'Discount / Rebate Concession',
        quantity: new Prisma.Decimal(1),
        unitRate: discountAmount.negated(),
        amount: discountAmount.negated(),
      });
    }

    // Current Charges Total = maintenance + water + other + penalty - discount
    const currentChargesTotal = maintenanceAmount
      .plus(waterAmount)
      .plus(otherChargesAmount)
      .plus(penaltyAmount)
      .minus(discountAmount);

    // Calculate Previous Outstanding Arrears:
    // Sum outstanding unpaid balance on past finalized/issued invoices for this apartment prior to this period
    const pastInvoices = await this.prisma.apartmentInvoice.findMany({
      where: {
        apartmentId: dto.apartmentId,
        periodCode: { lt: dto.periodCode },
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { balanceDue: true },
    });

    const previousArrears = pastInvoices.reduce(
      (sum, inv) => sum.plus(inv.balanceDue),
      new Prisma.Decimal(0),
    );

    // Total Due = Current Charges Total + Previous Arrears
    const totalDue = currentChargesTotal.plus(previousArrears);
    const paidAmount = existing ? existing.paidAmount : new Prisma.Decimal(0);
    const balanceDue = totalDue.minus(paidAmount);

    // Resolve Due Date
    let dueDate: Date;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
    } else {
      const period = await this.prisma.billingPeriod.findUnique({
        where: {
          buildingId_periodCode: {
            buildingId: dto.buildingId,
            periodCode: dto.periodCode,
          },
        },
      });
      if (period) {
        dueDate = period.dueDate;
      } else {
        const days = buildingSetting?.defaultDueDays ?? 15;
        dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }

    // Generate Invoice Number: INV-BUILDING-PERIOD-UNIT
    const cleanBuildingName = apartment.building.name
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 4)
      .toUpperCase();
    const cleanUnit = apartment.unitNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const periodPart = dto.periodCode.replace('-', '');
    const invoiceNumber =
      existing?.invoiceNumber || `INV-${cleanBuildingName}-${periodPart}-${cleanUnit}`;

    const invoiceStatus: ApartmentInvoiceStatus = dto.finalize ? 'ISSUED' : 'DRAFT';

    // Execute in Database Transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      let inv;
      if (existing) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
        inv = await tx.apartmentInvoice.update({
          where: { id: existing.id },
          data: {
            dueDate,
            status: invoiceStatus,
            apartmentAreaSqft: calculatedArea,
            maintenanceRate,
            maintenanceAmount,
            waterAmount,
            otherChargesAmount,
            penaltyAmount,
            discountAmount,
            currentChargesTotal,
            previousArrears,
            totalDue,
            balanceDue,
            notes: dto.notes ?? existing.notes,
            finalizedAt: dto.finalize ? new Date() : existing.finalizedAt,
            finalizedByUserId: dto.finalize ? user.id : existing.finalizedByUserId,
          },
        });
      } else {
        inv = await tx.apartmentInvoice.create({
          data: {
            organizationId: dto.organizationId,
            buildingId: dto.buildingId,
            apartmentId: dto.apartmentId,
            periodCode: dto.periodCode,
            invoiceNumber,
            dueDate,
            status: invoiceStatus,
            apartmentAreaSqft: calculatedArea,
            maintenanceRate,
            maintenanceAmount,
            waterAmount,
            otherChargesAmount,
            penaltyAmount,
            discountAmount,
            currentChargesTotal,
            previousArrears,
            totalDue,
            paidAmount: new Prisma.Decimal(0),
            balanceDue: totalDue,
            notes: dto.notes ?? null,
            finalizedAt: dto.finalize ? new Date() : null,
            finalizedByUserId: dto.finalize ? user.id : null,
          },
        });
      }

      // Create Line Items with room snapshot preservation
      for (const item of lineItemsToCreate) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: inv.id,
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitRate: item.unitRate,
            amount: item.amount,
            roomId: item.roomId ?? null,
            roomName: item.roomName ?? null,
            roomType: item.roomType ?? null,
          },
        });
      }

      return inv;
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: dto.finalize ? 'INVOICE_FINALIZED' : 'INVOICE_GENERATED',
      entityType: 'ApartmentInvoice',
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        apartmentId: dto.apartmentId,
        periodCode: dto.periodCode,
        totalDue: totalDue.toString(),
      },
    });

    return this.findOneInvoice(invoice.id, user);
  }

  async bulkGenerateInvoices(dto: BulkGenerateInvoicesDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    // Get all active apartments for this building
    const apartments = await this.prisma.apartment.findMany({
      where: {
        buildingId: dto.buildingId,
        organizationId: dto.organizationId,
        isActive: true,
      },
    });

    if (apartments.length === 0) {
      throw new BadRequestException('No active apartments found in selected building');
    }

    const generatedInvoices = [];
    const skippedApartments = [];

    for (const apt of apartments) {
      // Check if invoice already exists for period
      const existing = await this.prisma.apartmentInvoice.findUnique({
        where: {
          apartmentId_periodCode: {
            apartmentId: apt.id,
            periodCode: dto.periodCode,
          },
        },
      });

      if (existing && existing.status !== 'DRAFT') {
        skippedApartments.push({ unitNumber: apt.unitNumber, reason: `Already ${existing.status}` });
        continue;
      }

      const inv = await this.generateInvoice(
        {
          organizationId: dto.organizationId,
          buildingId: dto.buildingId,
          apartmentId: apt.id,
          periodCode: dto.periodCode,
          dueDate: dto.dueDate,
          includeWater: dto.includeWater,
          additionalCharges: dto.commonCharges,
          finalize: dto.finalize,
        },
        user,
      );
      generatedInvoices.push(inv);
    }

    return {
      message: `Bulk generation complete: ${generatedInvoices.length} invoices generated for period ${dto.periodCode}`,
      generatedCount: generatedInvoices.length,
      skippedCount: skippedApartments.length,
      skippedApartments,
      invoices: generatedInvoices,
    };
  }

  async finalizeInvoices(dto: FinalizeInvoicesDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const records = [];
      for (const invId of dto.invoiceIds) {
        const invoice = await tx.apartmentInvoice.findUnique({
          where: { id: invId },
        });

        if (!invoice || invoice.organizationId !== dto.organizationId) {
          continue;
        }

        if (invoice.status === 'DRAFT') {
          const rec = await tx.apartmentInvoice.update({
            where: { id: invId },
            data: {
              status: 'ISSUED',
              finalizedAt: now,
              finalizedByUserId: user.id,
            },
          });
          records.push(rec);
        }
      }
      return records;
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'INVOICES_FINALIZED',
      entityType: 'ApartmentInvoice',
      metadata: { finalizedCount: updated.length, invoiceIds: dto.invoiceIds },
    });

    return {
      message: `Successfully finalized ${updated.length} invoices.`,
      finalizedCount: updated.length,
    };
  }

  async createAdjustment(dto: CreateAdjustmentDto, user: AuthenticatedUser) {
    const invoice = await this.prisma.apartmentInvoice.findUnique({
      where: { id: dto.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    this.verifyTenantAccess(user, invoice.organizationId);

    if (invoice.status === 'VOID') {
      throw new BadRequestException('Cannot adjust a void invoice');
    }

    const adjAmount = new Prisma.Decimal(dto.amount);
    let netAdjustment = adjAmount;

    // Credit/Waiver decreases totalDue & balanceDue; Debit/Correction increases
    if (dto.adjustmentType === 'CREDIT' || dto.adjustmentType === 'WAIVER') {
      netAdjustment = adjAmount.negated();
    }

    const newTotalDue = invoice.totalDue.plus(netAdjustment);
    const newBalanceDue = invoice.balanceDue.plus(netAdjustment);

    let newStatus = invoice.status;
    if (newBalanceDue.lessThanOrEqualTo(0)) {
      newStatus = 'PAID';
    } else if (invoice.paidAmount.greaterThan(0)) {
      newStatus = 'PARTIALLY_PAID';
    } else if (invoice.dueDate < new Date()) {
      newStatus = 'OVERDUE';
    } else {
      newStatus = 'ISSUED';
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.invoiceAdjustment.create({
        data: {
          invoiceId: dto.invoiceId,
          amount: adjAmount,
          adjustmentType: dto.adjustmentType,
          reason: dto.reason.trim(),
          authorizedByUserId: user.id,
        },
      });

      // Add corresponding line item
      await tx.invoiceItem.create({
        data: {
          invoiceId: dto.invoiceId,
          itemType: 'ADJUSTMENT',
          description: `Adjustment [${dto.adjustmentType}]: ${dto.reason.trim()}`,
          quantity: new Prisma.Decimal(1),
          unitRate: netAdjustment,
          amount: netAdjustment,
        },
      });

      const updatedInvoice = await tx.apartmentInvoice.update({
        where: { id: dto.invoiceId },
        data: {
          totalDue: newTotalDue,
          balanceDue: newBalanceDue,
          status: newStatus,
        },
      });

      return { adjustment, updatedInvoice };
    });

    await this.auditService.log({
      organizationId: invoice.organizationId,
      actorUserId: user.id,
      action: 'INVOICE_ADJUSTED',
      entityType: 'InvoiceAdjustment',
      entityId: result.adjustment.id,
      metadata: {
        invoiceId: dto.invoiceId,
        adjustmentType: dto.adjustmentType,
        amount: dto.amount,
        reason: dto.reason,
      },
    });

    return result;
  }

  async getPdfBuffer(invoiceId: string, user: AuthenticatedUser): Promise<Buffer> {
    const invoice = await this.findOneInvoice(invoiceId, user);
    const buildingSetting = invoice.building.billingSettings[0];

    return this.invoicePdfService.generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      periodCode: invoice.periodCode,
      periodName: invoice.billingPeriod?.name,
      buildingName: invoice.building.name,
      buildingAddress: invoice.building.address,
      towerName: invoice.apartment.tower?.name,
      unitNumber: invoice.apartment.unitNumber,
      floor: invoice.apartment.floor,
      areaSqft: invoice.apartmentAreaSqft.toNumber(),
      ownerName: invoice.apartment.ownerName,
      residentName: invoice.apartment.residentName,
      ownerPhone: invoice.apartment.ownerPhone,
      maintenanceRate: invoice.maintenanceRate.toNumber(),
      maintenanceAmount: invoice.maintenanceAmount.toNumber(),
      waterAmount: invoice.waterAmount.toNumber(),
      otherChargesAmount: invoice.otherChargesAmount.toNumber(),
      penaltyAmount: invoice.penaltyAmount.toNumber(),
      discountAmount: invoice.discountAmount.toNumber(),
      currentChargesTotal: invoice.currentChargesTotal.toNumber(),
      previousArrears: invoice.previousArrears.toNumber(),
      totalDue: invoice.totalDue.toNumber(),
      paidAmount: invoice.paidAmount.toNumber(),
      balanceDue: invoice.balanceDue.toNumber(),
      items: invoice.items.map((i) => ({
        itemType: i.itemType,
        description: i.description,
        quantity: i.quantity.toNumber(),
        unitRate: i.unitRate.toNumber(),
        amount: i.amount.toNumber(),
        roomId: i.roomId,
        roomName: i.roomName,
        roomType: i.roomType,
      })),
      waterReading: invoice.waterReading
        ? {
            previousReading: invoice.waterReading.previousReading.toNumber(),
            currentReading: invoice.waterReading.currentReading.toNumber(),
            consumption: invoice.waterReading.consumption.toNumber(),
            ratePerUnit: invoice.waterReading.ratePerUnit.toNumber(),
            fixedCharge: invoice.waterReading.fixedCharge.toNumber(),
            totalAmount: invoice.waterReading.totalAmount.toNumber(),
          }
        : null,
      bankName: buildingSetting?.bankName,
      bankAccountName: buildingSetting?.bankAccountName,
      bankAccountNumber: buildingSetting?.bankAccountNumber,
      bankBranch: buildingSetting?.bankBranch,
      paymentInstructions: buildingSetting?.paymentInstructions,
      contactEmail: buildingSetting?.contactEmail,
      contactPhone: buildingSetting?.contactPhone,
      contactPerson: buildingSetting?.contactPerson,
      noticeText: buildingSetting?.noticeText,
    });
  }
}
