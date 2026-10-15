import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillingService } from './billing.service';
import { PaymentsService } from '../payments/payments.service';
import { WaterReadingsService } from '../water-readings/water-readings.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('Apartment Billing System & Calculation Engine', () => {
  let billingService: BillingService;
  let paymentsService: PaymentsService;
  let waterReadingsService: WaterReadingsService;

  let mockPrisma: any;
  let mockAudit: any;
  let mockPdf: any;
  let mockReceiptPdf: any;

  const mockUser: AuthenticatedUser = {
    id: 'user-manager-1',
    email: 'manager@acme.com',
    name: 'Bob Manager',
    status: 'ACTIVE',
    isPlatformAdmin: false,
    memberships: [
      {
        id: 'mem-1',
        roleId: 'role-manager',
        roleName: 'MANAGER',
        organizationId: 'org-demo',
        organizationName: 'Acme Properties',
        organizationSlug: 'acme-properties',
        buildingId: 'span-tower-ix',
        permissions: ['billing.manage', 'billing.read', 'payments.manage', 'payments.read'],
      },
    ],
  };

  beforeEach(() => {
    mockAudit = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockPdf = {
      generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('PDF_CONTENT')),
    };

    mockReceiptPdf = {
      generateReceiptPdf: jest.fn().mockResolvedValue(Buffer.from('RECEIPT_PDF_CONTENT')),
    };

    mockPrisma = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      building: {
        findUnique: jest.fn(),
      },
      apartment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      billingSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      billingPeriod: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      waterReading: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      apartmentInvoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoiceItem: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      apartmentPayment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      paymentAllocation: {
        create: jest.fn(),
      },
      invoiceAdjustment: {
        create: jest.fn(),
      },
    };

    billingService = new BillingService(mockPrisma, mockAudit, mockPdf);
    paymentsService = new PaymentsService(mockPrisma, mockAudit, mockReceiptPdf);
    waterReadingsService = new WaterReadingsService(mockPrisma, mockAudit);
  });

  describe('1. Maintenance Fee Calculation', () => {
    it('should calculate maintenance fee accurately: area_sqft × maintenance_rate using Decimal-safe math', () => {
      const area = new Prisma.Decimal('1000.00');
      const rate = new Prisma.Decimal('10.00');
      const maintenanceAmount = area.times(rate);

      expect(maintenanceAmount.toString()).toBe('10000');
      expect(maintenanceAmount.toFixed(2)).toBe('10000.00');
    });

    it('should handle fractional areas and rates with strict Decimal precision (no floating-point rounding errors)', () => {
      const area = new Prisma.Decimal('1050.75');
      const rate = new Prisma.Decimal('12.50');
      const maintenanceAmount = area.times(rate);

      expect(maintenanceAmount.toFixed(2)).toBe('13134.38');
    });
  });

  describe('2. Water Reading & Tariffs Calculation', () => {
    it('should calculate consumption and water charges: (current - previous) * tariff + fixedCharge', async () => {
      mockPrisma.apartment.findFirst.mockResolvedValue({
        id: 'apt-4b',
        unitNumber: '4B',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        building: {
          name: 'Span Tower IX',
          billingSettings: [
            {
              waterTariffPerUnit: new Prisma.Decimal('100.00'),
              waterFixedCharge: new Prisma.Decimal('0.00'),
            },
          ],
        },
      });

      mockPrisma.billingPeriod.findUnique.mockResolvedValue({
        id: 'period-2026-10',
        periodCode: '2026-10',
      });

      mockPrisma.waterReading.upsert.mockImplementation((args: any) => ({
        id: 'wr-1',
        ...args.create,
      }));

      const reading = await waterReadingsService.recordReading(
        {
          organizationId: 'org-demo',
          buildingId: 'span-tower-ix',
          apartmentId: 'apt-4b',
          periodCode: '2026-10',
          previousReading: 120.0,
          currentReading: 125.0,
        },
        mockUser,
      );

      expect(reading.consumption.toString()).toBe('5');
      expect(reading.totalAmount.toString()).toBe('500');
    });

    it('should reject negative consumption unless authorized correction is explicitly permitted', async () => {
      mockPrisma.apartment.findFirst.mockResolvedValue({
        id: 'apt-4b',
        unitNumber: '4B',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        building: { billingSettings: [] },
      });

      await expect(
        waterReadingsService.recordReading(
          {
            organizationId: 'org-demo',
            buildingId: 'span-tower-ix',
            apartmentId: 'apt-4b',
            periodCode: '2026-10',
            previousReading: 130.0,
            currentReading: 125.0, // Less than previous!
            allowCorrection: false,
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Required Example Verification (Prompt Specification)',
    () => {
      it('calculates: area 1,000 sq ft, rate Rs. 10/sq ft, water Rs. 500, other Rs. 200, previous arrears Rs. 1,000 -> bill before payment must be Rs. 11,700, and remaining after payment of Rs. 2,000 must be Rs. 9,700', async () => {
        // Setup Apartment
        mockPrisma.apartment.findFirst.mockResolvedValue({
          id: 'apt-4b',
          organizationId: 'org-demo',
          buildingId: 'span-tower-ix',
          unitNumber: '4B',
          areaSqft: new Prisma.Decimal('1000.00'),
          building: {
            name: 'Span Tower IX',
            billingSettings: [
              {
                maintenanceRatePerSqft: new Prisma.Decimal('10.00'),
                defaultDueDays: 15,
                bankName: 'Commercial Bank of Ceylon',
              },
            ],
          },
        });

        // Setup Water Reading (5 units @ Rs. 100 = Rs. 500)
        mockPrisma.waterReading.findUnique.mockResolvedValue({
          id: 'wr-1',
          consumption: new Prisma.Decimal('5.00'),
          ratePerUnit: new Prisma.Decimal('100.00'),
          fixedCharge: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('500.00'),
        });

        // Setup previous invoices for arrears calculation: Rs. 1,000
        mockPrisma.apartmentInvoice.findMany.mockResolvedValue([
          {
            id: 'inv-prev-1',
            invoiceNumber: 'INV-ST9-202609-4B',
            balanceDue: new Prisma.Decimal('1000.00'),
          },
        ]);

        // Invoice mock create
        let createdInvoiceData: any = null;
        mockPrisma.apartmentInvoice.create.mockImplementation((args: any) => {
          createdInvoiceData = {
            id: 'inv-4b-2026-10',
            ...args.data,
            building: { name: 'Span Tower IX', address: 'Colombo 06', billingSettings: [] },
            apartment: { unitNumber: '4B', floor: 4, areaSqft: new Prisma.Decimal('1000.00') },
            billingPeriod: { name: 'October 2026', periodCode: '2026-10' },
            items: [],
            allocations: [],
            adjustments: [],
          };
          return createdInvoiceData;
        });

        mockPrisma.apartmentInvoice.findUnique.mockImplementation(() => createdInvoiceData);

        // A. Generate Invoice
        const invoice = await billingService.generateInvoice(
          {
            organizationId: 'org-demo',
            buildingId: 'span-tower-ix',
            apartmentId: 'apt-4b',
            periodCode: '2026-10',
            includeWater: true,
            additionalCharges: [
              {
                itemType: 'UTILITY',
                description: 'Generator Fuel & Utility Surcharge',
                unitRate: 200.0,
                amount: 200.0,
              },
            ],
            finalize: true,
          },
          mockUser,
        );

        // Verification of invoice before payment
        expect(invoice).toBeDefined();
        expect(createdInvoiceData.maintenanceAmount.toString()).toBe('10000');
        expect(createdInvoiceData.waterAmount.toString()).toBe('500');
        expect(createdInvoiceData.otherChargesAmount.toString()).toBe('200');
        expect(createdInvoiceData.currentChargesTotal.toString()).toBe('10700');
        expect(createdInvoiceData.previousArrears.toString()).toBe('1000');
        expect(createdInvoiceData.totalDue.toString()).toBe('11700');
        expect(createdInvoiceData.balanceDue.toString()).toBe('11700');
        expect(createdInvoiceData.status).toBe('ISSUED');

        // B. Process Payment of Rs. 2,000
        mockPrisma.apartmentPayment.findUnique.mockResolvedValue(null); // No duplicate ref
        mockPrisma.apartmentInvoice.findMany.mockResolvedValue([createdInvoiceData]);

        let updatedInvoiceState = { ...createdInvoiceData };
        mockPrisma.apartmentInvoice.update.mockImplementation((args: any) => {
          updatedInvoiceState = { ...updatedInvoiceState, ...args.data };
          return updatedInvoiceState;
        });

        mockPrisma.apartmentPayment.create.mockImplementation((args: any) => ({
          id: 'pay-1',
          receiptNumber: 'REC-ST9-202610-0001',
          ...args.data,
          building: { name: 'Span Tower IX', address: 'Colombo 06' },
          apartment: { unitNumber: '4B', floor: 4 },
          recordedByUser: { name: 'Bob Manager' },
          allocations: [
            {
              amount: new Prisma.Decimal('2000.00'),
              invoice: updatedInvoiceState,
            },
          ],
        }));

        mockPrisma.apartmentPayment.findUnique.mockImplementation((args: any) => {
          if (args.where?.organizationId_paymentReference) {
            return null; // Not a duplicate reference!
          }
          return {
            id: 'pay-1',
            organizationId: 'org-demo',
            receiptNumber: 'REC-ST9-202610-0001',
            amount: new Prisma.Decimal('2000.00'),
            paymentMethod: 'BANK_TRANSFER',
            paymentReference: 'TXN-998822',
            paymentDate: new Date(),
            status: 'COMPLETED',
            building: { name: 'Span Tower IX', address: 'Colombo 06' },
            apartment: { unitNumber: '4B', floor: 4 },
            recordedByUser: { name: 'Bob Manager' },
            allocations: [
              {
                amount: new Prisma.Decimal('2000.00'),
                invoice: updatedInvoiceState,
              },
            ],
          };
        });

        const payment = await paymentsService.recordPayment(
          {
            organizationId: 'org-demo',
            buildingId: 'span-tower-ix',
            apartmentId: 'apt-4b',
            amount: 2000.0,
            paymentMethod: 'BANK_TRANSFER',
            paymentReference: 'TXN-998822',
          },
          mockUser,
        );

        // Verification after payment
        expect(payment).toBeDefined();
        expect(updatedInvoiceState.paidAmount.toString()).toBe('2000');
        expect(updatedInvoiceState.balanceDue.toString()).toBe('9700');
        expect(updatedInvoiceState.status).toBe('PARTIALLY_PAID');
      });
  });

  describe('4. Duplicate Invoices & Duplicate Payment References Prevention', () => {
    it('should prevent creating duplicate finalized invoice for the same apartment and period', async () => {
      mockPrisma.apartmentInvoice.findUnique.mockResolvedValue({
        id: 'inv-existing',
        invoiceNumber: 'INV-ST9-202610-4B',
        status: 'ISSUED', // already finalized!
      });

      await expect(
        billingService.generateInvoice(
          {
            organizationId: 'org-demo',
            buildingId: 'span-tower-ix',
            apartmentId: 'apt-4b',
            periodCode: '2026-10',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent recording duplicate payment reference in the same organization', async () => {
      mockPrisma.apartment.findFirst.mockResolvedValue({
        id: 'apt-4b',
        buildingId: 'span-tower-ix',
        building: { name: 'Span Tower IX' },
      });

      mockPrisma.apartmentPayment.findUnique.mockResolvedValue({
        id: 'pay-existing',
        paymentReference: 'REF-DUP-12345',
        paymentDate: new Date(),
      });

      await expect(
        paymentsService.recordPayment(
          {
            organizationId: 'org-demo',
            buildingId: 'span-tower-ix',
            apartmentId: 'apt-4b',
            amount: 5000.0,
            paymentMethod: 'CASH',
            paymentReference: 'REF-DUP-12345',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('5. Auditable Adjustments & Corrections', () => {
    it('should apply credit adjustment and reduce totalDue and balanceDue without overwriting historical records', async () => {
      const originalInvoice = {
        id: 'inv-adj-1',
        organizationId: 'org-demo',
        status: 'ISSUED',
        totalDue: new Prisma.Decimal('11700.00'),
        paidAmount: new Prisma.Decimal('2000.00'),
        balanceDue: new Prisma.Decimal('9700.00'),
        dueDate: new Date(Date.now() + 864000000),
      };

      mockPrisma.apartmentInvoice.findUnique.mockResolvedValue(originalInvoice);
      mockPrisma.invoiceAdjustment.create.mockResolvedValue({ id: 'adj-1' });
      mockPrisma.apartmentInvoice.update.mockImplementation((args: any) => args.data);

      const result = await billingService.createAdjustment(
        {
          invoiceId: 'inv-adj-1',
          adjustmentType: 'CREDIT',
          amount: 500.0,
          reason: 'Water meter calibration rebate approved by Management',
        },
        mockUser,
      );

      expect(result.updatedInvoice.totalDue.toString()).toBe('11200');
      expect(result.updatedInvoice.balanceDue.toString()).toBe('9200');
    });
  });

  describe('6. Multi-Room Apartment Billing Hierarchy & Snapshot Accuracy', () => {
    it('calculates 5 individual rooms of different sizes, apartment total area & maintenance, additional charges, previous balance, and partial payment', async () => {
      // 5 Rooms of different sizes matching prompt
      const fiveRooms = [
        {
          id: 'room-1',
          roomNumber: 'Bedroom 1',
          roomType: 'BEDROOM',
          areaSqft: new Prisma.Decimal('150.00'),
          maintenanceRate: null, // uses default Rs. 10
          isActive: true,
        },
        {
          id: 'room-2',
          roomNumber: 'Bedroom 2',
          roomType: 'BEDROOM',
          areaSqft: new Prisma.Decimal('120.00'),
          maintenanceRate: null,
          isActive: true,
        },
        {
          id: 'room-3',
          roomNumber: 'Living Room',
          roomType: 'LIVING_ROOM',
          areaSqft: new Prisma.Decimal('220.00'),
          maintenanceRate: null,
          isActive: true,
        },
        {
          id: 'room-4',
          roomNumber: 'Kitchen',
          roomType: 'KITCHEN',
          areaSqft: new Prisma.Decimal('100.00'),
          maintenanceRate: null,
          isActive: true,
        },
        {
          id: 'room-5',
          roomNumber: 'Bathroom',
          roomType: 'BATHROOM',
          areaSqft: new Prisma.Decimal('40.00'),
          maintenanceRate: null,
          isActive: true,
        },
      ];

      mockPrisma.apartment.findFirst.mockResolvedValue({
        id: 'apt-a101',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        unitNumber: 'A-101',
        areaSqft: new Prisma.Decimal('630.00'),
        tower: { id: 'tower-a', name: 'Tower A', code: 'A' },
        rooms: fiveRooms,
        building: {
          name: 'Span Tower IX',
          address: 'Colombo 06',
          billingSettings: [
            {
              maintenanceRatePerSqft: new Prisma.Decimal('10.00'),
              defaultDueDays: 15,
              bankName: 'Sampath Bank PLC',
            },
          ],
        },
      });

      // Previous unpaid invoice: Rs. 800
      mockPrisma.apartmentInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-prev',
          balanceDue: new Prisma.Decimal('800.00'),
        },
      ]);

      // Water reading: 3 units @ Rs. 150 = Rs. 450
      mockPrisma.waterReading.findUnique.mockResolvedValue({
        id: 'wr-101',
        consumption: new Prisma.Decimal('3.00'),
        ratePerUnit: new Prisma.Decimal('150.00'),
        fixedCharge: new Prisma.Decimal('0.00'),
        totalAmount: new Prisma.Decimal('450.00'),
      });

      const createdItems: any[] = [];
      let savedInvoice: any = null;
      mockPrisma.apartmentInvoice.create.mockImplementation((args: any) => {
        savedInvoice = {
          id: 'inv-a101-202610',
          ...args.data,
          items: createdItems,
        };
        return savedInvoice;
      });

      mockPrisma.invoiceItem.create.mockImplementation((args: any) => {
        createdItems.push({ id: `item-${createdItems.length + 1}`, ...args.data });
        return { id: `item-${createdItems.length}`, ...args.data };
      });

      mockPrisma.apartmentInvoice.findUnique.mockImplementation(() => savedInvoice);

      // 1. Generate Invoice with 5 rooms and additional common electricity charge (Rs. 350)
      const invoice = await billingService.generateInvoice(
        {
          organizationId: 'org-demo',
          buildingId: 'span-tower-ix',
          apartmentId: 'apt-a101',
          periodCode: '2026-10',
          includeWater: true,
          additionalCharges: [
            {
              itemType: 'UTILITY',
              description: 'Common Electricity Surcharge',
              unitRate: 350.0,
              amount: 350.0,
            },
          ],
          finalize: true,
        },
        mockUser,
      );

      expect(invoice).toBeDefined();
      // Total room area = 150 + 120 + 220 + 100 + 40 = 630 sq. ft.
      expect(savedInvoice.apartmentAreaSqft.toString()).toBe('630');

      // Total room maintenance = 1,500 + 1,200 + 2,200 + 1,000 + 400 = Rs. 6,300
      expect(savedInvoice.maintenanceAmount.toString()).toBe('6300');

      // Water = Rs. 450, Other = Rs. 350, Current total = 6300 + 450 + 350 = Rs. 7,100
      expect(savedInvoice.waterAmount.toString()).toBe('450');
      expect(savedInvoice.otherChargesAmount.toString()).toBe('350');
      expect(savedInvoice.currentChargesTotal.toString()).toBe('7100');

      // Previous Arrears = Rs. 800 => Total Due Before Payment = Rs. 7,900
      expect(savedInvoice.previousArrears.toString()).toBe('800');
      expect(savedInvoice.totalDue.toString()).toBe('7900');
      expect(savedInvoice.balanceDue.toString()).toBe('7900');

      // Verify each individual room is captured as a distinct line item with snapshot data
      const roomLineItems = createdItems.filter((i) => i.itemType === 'ROOM_MAINTENANCE');
      expect(roomLineItems).toHaveLength(5);

      expect(roomLineItems[0].roomName).toBe('Bedroom 1');
      expect(roomLineItems[0].quantity.toString()).toBe('150');
      expect(roomLineItems[0].unitRate.toString()).toBe('10');
      expect(roomLineItems[0].amount.toString()).toBe('1500');

      expect(roomLineItems[1].roomName).toBe('Bedroom 2');
      expect(roomLineItems[1].quantity.toString()).toBe('120');
      expect(roomLineItems[1].amount.toString()).toBe('1200');

      expect(roomLineItems[2].roomName).toBe('Living Room');
      expect(roomLineItems[2].quantity.toString()).toBe('220');
      expect(roomLineItems[2].amount.toString()).toBe('2200');

      expect(roomLineItems[3].roomName).toBe('Kitchen');
      expect(roomLineItems[3].quantity.toString()).toBe('100');
      expect(roomLineItems[3].amount.toString()).toBe('1000');

      expect(roomLineItems[4].roomName).toBe('Bathroom');
      expect(roomLineItems[4].quantity.toString()).toBe('40');
      expect(roomLineItems[4].amount.toString()).toBe('400');

      // 2. Process Partial Payment of Rs. 2,500
      let updatedInvoice = { ...savedInvoice };
      mockPrisma.apartmentInvoice.update.mockImplementation((args: any) => {
        updatedInvoice = { ...updatedInvoice, ...args.data };
        return updatedInvoice;
      });

      mockPrisma.apartmentPayment.findUnique.mockImplementation((args: any) => {
        if (args.where?.organizationId_paymentReference) {
          return null;
        }
        return {
          id: 'pay-2',
          organizationId: 'org-demo',
          receiptNumber: 'REC-ST9-202610-0002',
          amount: new Prisma.Decimal('2500.00'),
          paymentMethod: 'CASH',
          paymentReference: 'REC-CASH-7890',
          paidAt: new Date(),
          building: { name: 'Span Tower IX', address: 'Colombo 06' },
          apartment: { unitNumber: 'A-101', floor: 1 },
          recordedByUser: { name: 'Alice Admin' },
          allocations: [
            {
              amount: new Prisma.Decimal('2500.00'),
              invoice: updatedInvoice,
            },
          ],
        };
      });
      mockPrisma.apartmentInvoice.findMany.mockResolvedValue([savedInvoice]);

      mockPrisma.apartmentPayment.create.mockImplementation((args: any) => ({
        id: 'pay-2',
        receiptNumber: 'REC-ST9-202610-0002',
        ...args.data,
      }));

      const payment = await paymentsService.recordPayment(
        {
          organizationId: 'org-demo',
          buildingId: 'span-tower-ix',
          apartmentId: 'apt-a101',
          amount: 2500.0,
          paymentMethod: 'CASH',
          paymentReference: 'REC-CASH-7890',
        },
        mockUser,
      );

      // Remaining balance = Rs. 7,900 - 2,500 = Rs. 5,400
      expect(payment).toBeDefined();
      expect(updatedInvoice.paidAmount.toString()).toBe('2500');
      expect(updatedInvoice.balanceDue.toString()).toBe('5400');
      expect(updatedInvoice.status).toBe('PARTIALLY_PAID');
    });

    it('supports custom room-specific maintenance rates without changing other rooms', async () => {
      const customRooms = [
        {
          id: 'room-master',
          roomNumber: 'Master Suite',
          roomType: 'BEDROOM',
          areaSqft: new Prisma.Decimal('200.00'),
          maintenanceRate: new Prisma.Decimal('15.00'), // Custom rate: Rs. 15/sqft
          isActive: true,
        },
        {
          id: 'room-balcony',
          roomNumber: 'Terrace Balcony',
          roomType: 'BALCONY',
          areaSqft: new Prisma.Decimal('100.00'),
          maintenanceRate: new Prisma.Decimal('6.00'), // Discounted rate: Rs. 6/sqft
          isActive: true,
        },
      ];

      mockPrisma.apartment.findFirst.mockResolvedValue({
        id: 'apt-custom',
        organizationId: 'org-demo',
        buildingId: 'span-tower-ix',
        unitNumber: 'Penthouse',
        areaSqft: new Prisma.Decimal('300.00'),
        tower: null,
        rooms: customRooms,
        building: {
          name: 'Span Tower IX',
          address: 'Colombo 06',
          billingSettings: [{ maintenanceRatePerSqft: new Prisma.Decimal('10.00') }],
        },
      });

      mockPrisma.apartmentInvoice.findMany.mockResolvedValue([]);
      mockPrisma.waterReading.findUnique.mockResolvedValue(null);

      const items: any[] = [];
      let invoiceData: any = null;
      mockPrisma.apartmentInvoice.create.mockImplementation((args: any) => {
        invoiceData = { id: 'inv-custom', ...args.data };
        return invoiceData;
      });
      mockPrisma.invoiceItem.create.mockImplementation((args: any) => {
        items.push(args.data);
        return args.data;
      });

      mockPrisma.apartmentInvoice.findUnique.mockImplementation(() => invoiceData);

      await billingService.generateInvoice(
        {
          organizationId: 'org-demo',
          buildingId: 'span-tower-ix',
          apartmentId: 'apt-custom',
          periodCode: '2026-10',
          includeWater: false,
        },
        mockUser,
      );

      // (200 × 15 = 3000) + (100 × 6 = 600) = Rs. 3,600
      expect(invoiceData.maintenanceAmount.toString()).toBe('3600');
      expect(invoiceData.apartmentAreaSqft.toString()).toBe('300');
      expect(items[0].unitRate.toString()).toBe('15');
      expect(items[0].amount.toString()).toBe('3000');
      expect(items[1].unitRate.toString()).toBe('6');
      expect(items[1].amount.toString()).toBe('600');
    });
  });
});
