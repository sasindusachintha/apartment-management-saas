import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BulkWaterReadingDto,
  RecordWaterReadingDto,
} from './dto/record-water-reading.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class WaterReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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
      periodCode?: string;
      apartmentId?: string;
    },
  ) {
    const where: Prisma.WaterReadingWhereInput = {};

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

    if (params.periodCode) {
      where.periodCode = params.periodCode;
    }

    if (params.apartmentId) {
      where.apartmentId = params.apartmentId;
    }

    return this.prisma.waterReading.findMany({
      where,
      include: {
        apartment: { select: { id: true, unitNumber: true, floor: true, ownerName: true, residentName: true } },
        building: { select: { id: true, name: true } },
        recordedByUser: { select: { id: true, name: true } },
      },
      orderBy: [{ periodCode: 'desc' }, { apartment: { unitNumber: 'asc' } }],
    });
  }

  async getLatestForApartment(apartmentId: string, user: AuthenticatedUser) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        building: {
          include: {
            billingSettings: true,
          },
        },
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    this.verifyTenantAccess(user, apartment.organizationId);

    const latestReading = await this.prisma.waterReading.findFirst({
      where: { apartmentId },
      orderBy: { readingDate: 'desc' },
    });

    const buildingSetting = apartment.building.billingSettings[0];

    return {
      apartmentId,
      unitNumber: apartment.unitNumber,
      buildingId: apartment.buildingId,
      buildingName: apartment.building.name,
      latestReading: latestReading ? Number(latestReading.currentReading) : 0,
      latestReadingDate: latestReading ? latestReading.readingDate : null,
      defaultTariffPerUnit: buildingSetting ? Number(buildingSetting.waterTariffPerUnit) : 100.0,
      defaultFixedCharge: buildingSetting ? Number(buildingSetting.waterFixedCharge) : 0.0,
    };
  }

  async recordReading(dto: RecordWaterReadingDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    // Verify apartment belongs to organization and building
    const apartment = await this.prisma.apartment.findFirst({
      where: {
        id: dto.apartmentId,
        organizationId: dto.organizationId,
        buildingId: dto.buildingId,
      },
      include: {
        building: {
          include: {
            billingSettings: true,
          },
        },
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found in specified building');
    }

    // Validate reading values
    const prev = new Prisma.Decimal(dto.previousReading);
    const curr = new Prisma.Decimal(dto.currentReading);

    if (curr.lessThan(prev) && !dto.allowCorrection) {
      throw new BadRequestException(
        `Current meter reading (${dto.currentReading}) cannot be less than previous meter reading (${dto.previousReading}) without authorized correction.`,
      );
    }

    const consumption = curr.minus(prev);

    // Get tariff rates
    const buildingSetting = apartment.building.billingSettings[0];
    const ratePerUnit =
      dto.ratePerUnit !== undefined
        ? new Prisma.Decimal(dto.ratePerUnit)
        : buildingSetting
          ? buildingSetting.waterTariffPerUnit
          : new Prisma.Decimal(100.0);

    const fixedCharge =
      dto.fixedCharge !== undefined
        ? new Prisma.Decimal(dto.fixedCharge)
        : buildingSetting
          ? buildingSetting.waterFixedCharge
          : new Prisma.Decimal(0.0);

    const totalAmount = consumption.times(ratePerUnit).plus(fixedCharge);

    // Find billing period if not provided
    let billingPeriodId = dto.billingPeriodId;
    if (!billingPeriodId) {
      const period = await this.prisma.billingPeriod.findUnique({
        where: {
          buildingId_periodCode: {
            buildingId: dto.buildingId,
            periodCode: dto.periodCode,
          },
        },
      });
      if (period) {
        billingPeriodId = period.id;
      }
    }

    const waterReading = await this.prisma.waterReading.upsert({
      where: {
        apartmentId_periodCode: {
          apartmentId: dto.apartmentId,
          periodCode: dto.periodCode,
        },
      },
      update: {
        previousReading: prev,
        currentReading: curr,
        consumption,
        ratePerUnit,
        fixedCharge,
        totalAmount,
        readingDate: dto.readingDate ? new Date(dto.readingDate) : new Date(),
        recordedByUserId: user.id,
        notes: dto.notes ?? null,
        billingPeriodId: billingPeriodId ?? null,
      },
      create: {
        organizationId: dto.organizationId,
        buildingId: dto.buildingId,
        apartmentId: dto.apartmentId,
        billingPeriodId: billingPeriodId ?? null,
        periodCode: dto.periodCode,
        previousReading: prev,
        currentReading: curr,
        consumption,
        ratePerUnit,
        fixedCharge,
        totalAmount,
        readingDate: dto.readingDate ? new Date(dto.readingDate) : new Date(),
        recordedByUserId: user.id,
        notes: dto.notes ?? null,
      },
      include: {
        apartment: { select: { id: true, unitNumber: true } },
      },
    });

    await this.auditService.log({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'WATER_READING_RECORDED',
      entityType: 'WaterReading',
      entityId: waterReading.id,
      metadata: {
        apartmentId: dto.apartmentId,
        periodCode: dto.periodCode,
        consumption: consumption.toString(),
        totalAmount: totalAmount.toString(),
      },
    });

    return waterReading;
  }

  async bulkRecord(dto: BulkWaterReadingDto, user: AuthenticatedUser) {
    this.verifyTenantAccess(user, dto.organizationId);

    const results = [];
    for (const item of dto.readings) {
      const res = await this.recordReading(
        {
          organizationId: dto.organizationId,
          buildingId: dto.buildingId,
          apartmentId: item.apartmentId,
          periodCode: dto.periodCode,
          previousReading: item.previousReading,
          currentReading: item.currentReading,
          allowCorrection: item.allowCorrection,
          notes: item.notes,
        },
        user,
      );
      results.push(res);
    }

    return {
      message: `Successfully recorded ${results.length} water meter readings for period ${dto.periodCode}`,
      count: results.length,
      readings: results,
    };
  }
}
