const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pereraUsers = await prisma.user.findMany({
    where: { name: { contains: 'Perera' } },
    include: {
      ownedApartments: true,
      residentApartments: true,
    },
  });
  console.log('PERERA USERS:', JSON.stringify(pereraUsers, null, 2));

  const pereraApts = await prisma.apartment.findMany({
    where: {
      OR: [
        { ownerName: { contains: 'Perera' } },
        { residentName: { contains: 'Perera' } },
        { owner: { name: { contains: 'Perera' } } },
        { resident: { name: { contains: 'Perera' } } },
      ],
    },
    include: {
      invoices: {
        include: {
          items: true,
        },
      },
      rooms: true,
    },
  });
  console.log('PERERA APARTMENTS COUNT:', pereraApts.length);
  for (const apt of pereraApts) {
    console.log(
      'APT:',
      apt.id,
      'unit:',
      apt.unitNumber,
      'owner:',
      apt.ownerName,
      'resident:',
      apt.residentName,
      'INVOICES COUNT:',
      apt.invoices.length,
    );
    for (const inv of apt.invoices) {
      console.log('  INV:', {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        periodCode: inv.periodCode,
        status: inv.status,
        issueDate: inv.issueDate,
        totalDue: inv.totalDue,
        balanceDue: inv.balanceDue,
        itemsCount: inv.items.length,
        createdAt: inv.createdAt,
      });
    }
  }

  // Also query all invoices to see what search=Mr. K. Perera returns in the API
  const allInvoices = await prisma.apartmentInvoice.findMany({
    include: {
      apartment: {
        include: {
          owner: true,
          resident: true,
        },
      },
    },
  });
  console.log('TOTAL INVOICES IN DB:', allInvoices.length);
  const matching = allInvoices.filter(
    (inv) =>
      inv.apartment?.ownerName?.includes('Perera') ||
      inv.apartment?.residentName?.includes('Perera') ||
      inv.apartment?.owner?.name?.includes('Perera') ||
      inv.apartment?.resident?.name?.includes('Perera'),
  );
  console.log('MATCHING INVOICES IN DB FOR PERERA:', matching.length);
  for (const m of matching) {
    console.log(
      'MATCH:',
      m.invoiceNumber,
      m.periodCode,
      m.apartment?.unitNumber,
      'owner:',
      m.apartment?.ownerName,
      'resident:',
      m.apartment?.residentName,
    );
  }
}

main().finally(() => prisma.$disconnect());

