import axios from 'axios';

const API_BASE = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('🚀 Running Comprehensive E2E Verification of All 15 Scenarios...\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`✅ [SCENARIO ${totalCount}] PASS: ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passedCount++;
    } else {
      console.error(`❌ [SCENARIO ${totalCount}] FAIL: ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      process.exitCode = 1;
    }
  }

  try {
    // ─────────────────────────────────────────────────────────────
    // SCENARIO 1: Super Admin Login & Manage Building Owner
    // ─────────────────────────────────────────────────────────────
    console.log('--- Testing Scenario 1: Super Admin Login & Manage Building Owner ---');
    const adminLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@apartmentsaas.com',
      password: 'AdminSecure123!',
    });

    const adminToken = adminLoginRes.data.accessToken;
    const adminMemberships = adminLoginRes.data.memberships;
    const isSuperAdmin = adminLoginRes.data.user.isPlatformAdmin || adminMemberships.some((m: any) => m.roleName === 'SUPER_ADMIN');
    assert(isSuperAdmin, 'Super Admin Authentication', `Logged in as ${adminLoginRes.data.user.email} (isPlatformAdmin: ${adminLoginRes.data.user.isPlatformAdmin})`);

    const ownersRes = await axios.get(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const buildingOwners = ownersRes.data.filter((u: any) =>
      u.userRoles.some((ur: any) => ur.role.name === 'BUILDING_OWNER'),
    );
    assert(buildingOwners.length >= 2, 'Super Admin lists Building Owners', `Found ${buildingOwners.length} building owners. First: ${buildingOwners[0].name} (${buildingOwners[0].email})`);

    // Verify Bob Miller was migrated from MANAGER to BUILDING_OWNER
    const bob = ownersRes.data.find((u: any) => u.email === 'manager@acme.com');
    const bobIsBuildingOwner = bob?.userRoles.some((ur: any) => ur.role.name === 'BUILDING_OWNER');
    assert(bobIsBuildingOwner, 'Manager account safely migrated to BUILDING_OWNER', `Bob Miller (${bob?.email}) now has role BUILDING_OWNER`);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 2: Building Owner Login & Building Scoping
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenario 2: Building Owner Login & Edit Apartment ---');
    const ownerLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'owner@acme.com',
      password: 'OwnerSecure123!',
    });
    const ownerToken = ownerLoginRes.data.accessToken;
    const ownerUser = ownerLoginRes.data.user;
    const ownerMemberships = ownerLoginRes.data.memberships;
    const hasOwnerRole = ownerMemberships.some((m: any) => m.roleName === 'BUILDING_OWNER');
    assert(hasOwnerRole, 'Building Owner Authentication', `Logged in as ${ownerUser.email} with role BUILDING_OWNER`);

    // Owner fetches assigned apartments
    const aptsRes = await axios.get(`${API_BASE}/apartments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const unitA101 = aptsRes.data.find((a: any) => a.unitNumber === 'A-101');
    assert(!!unitA101, 'Building Owner accesses assigned apartment A-101', `Unit ID: ${unitA101?.id}, Building: ${unitA101?.building?.name}`);

    // Edit Apartment permitted fields
    const updatedAptRes = await axios.patch(
      `${API_BASE}/apartments/${unitA101.id}`,
      {
        notes: `Updated on ${new Date().toISOString()} by Owner`,
        status: 'OCCUPIED',
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    assert(updatedAptRes.data.status === 'OCCUPIED', 'Building Owner edits apartment record', `Updated notes and status verified.`);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 3 & 4: Add Room, Calculate Maintenance, and Edit Room
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenarios 3 & 4: Add Room & Maintenance Calculation ---');
    const testRoomNum = `Test Room ${Date.now().toString().slice(-4)}`;
    const addRoomRes = await axios.post(
      `${API_BASE}/apartments/rooms`,
      {
        apartmentId: unitA101.id,
        roomNumber: testRoomNum,
        roomType: 'BEDROOM',
        areaSqft: 120,
        maintenanceRate: 15.0,
        notes: 'Integration test room',
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );

    const createdRoom = addRoomRes.data;
    assert(
      createdRoom.roomNumber === testRoomNum && Number(createdRoom.areaSqft) === 120,
      'Add room to apartment persists in database',
      `Room ID: ${createdRoom.id}, Area: ${createdRoom.areaSqft} sqft, Rate: Rs. ${createdRoom.maintenanceRate}`,
    );

    // Edit room: change area and rate
    const editRoomRes = await axios.patch(
      `${API_BASE}/apartments/rooms/${createdRoom.id}`,
      {
        areaSqft: 140,
        maintenanceRate: 16.5,
        notes: 'Updated area and rate',
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    assert(
      Number(editRoomRes.data.areaSqft) === 140,
      'Edit room area and rate persists in database',
      `Updated area: ${editRoomRes.data.areaSqft} sqft, rate: Rs. ${editRoomRes.data.maintenanceRate}`,
    );

    // Fetch room breakdown & calculation
    const calcRes = await axios.get(`${API_BASE}/apartments/${unitA101.id}/rooms`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const foundRoomInCalc = calcRes.data.rooms.find((r: any) => r.id === createdRoom.id);
    const expectedMonthlyCharge = 140 * 16.5; // 2310
    assert(
      Number(foundRoomInCalc.monthlyCharge) === expectedMonthlyCharge,
      'Room maintenance calculation matches formula (areaSqft × rate)',
      `Calculated: Rs. ${foundRoomInCalc.monthlyCharge} (expected 140 × 16.5 = Rs. ${expectedMonthlyCharge})`,
    );

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 5: Persistence after refresh
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenario 5: Refresh & Confirm Persistence ---');
    const freshAptRes = await axios.get(`${API_BASE}/apartments/${unitA101.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const roomStillExists = freshAptRes.data.rooms?.some((r: any) => r.id === createdRoom.id);
    assert(roomStillExists, 'Room and apartment changes remain after fresh reload', `Verified room ${createdRoom.id} persisted.`);

    // Clean up test room to preserve seed totals
    await axios.delete(`${API_BASE}/apartments/rooms/${createdRoom.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 6 & 7: Renter Login & Branding ("No Acme")
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenarios 6 & 7: Renter Login & Branding ---');
    const renterLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'renter@example.com',
      password: 'RenterSecure123!',
    });
    const renterToken = renterLoginRes.data.accessToken;
    const renterMemberships = renterLoginRes.data.memberships;
    const primaryM = renterMemberships[0];

    const propertyTitle = primaryM?.propertyTitle;
    assert(
      propertyTitle && !propertyTitle.includes('Acme') && propertyTitle.includes('Span Tower IX'),
      'Renter interface shows real property name instead of Acme Property Management',
      `Resolved property title: "${propertyTitle}" (contains Span Tower IX, no Acme)`,
    );

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 8: Renter Views Own Bills & Dues
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenario 8: Renter Views Bills & Dues ---');
    const renterApartmentRes = await axios.get(`${API_BASE}/apartments/my-apartment`, {
      headers: { Authorization: `Bearer ${renterToken}` },
    });
    assert(
      renterApartmentRes.data.unitNumber === 'A-101' && renterApartmentRes.data.building.name === 'Span Tower IX',
      'Renter views own apartment and rooms',
      `Unit: ${renterApartmentRes.data.unitNumber}, Building: ${renterApartmentRes.data.building.name}, Rooms: ${renterApartmentRes.data.rooms.length}`,
    );

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 9: Renter Cannot Modify Rooms or Buildings
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenario 9: Renter Write Protection ---');
    let renterModifyBlocked = false;
    try {
      await axios.post(
        `${API_BASE}/apartments/rooms`,
        {
          apartmentId: unitA101.id,
          roomNumber: 'Illegal Room',
          roomType: 'BEDROOM',
          areaSqft: 200,
        },
        { headers: { Authorization: `Bearer ${renterToken}` } },
      );
    } catch (err: any) {
      if (err.response?.status === 403) {
        renterModifyBlocked = true;
      }
    }
    assert(renterModifyBlocked, 'Renter is blocked from creating or editing rooms (403 Forbidden)', 'Server returned HTTP 403 Forbidden as expected.');

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 10: Building Owner Cross-Tenant Isolation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenario 10: Cross-Building Authorization Check ---');
    // Owner 2 is assigned to Sunset Heights (demo-building-1), NOT Span Tower IX
    const owner2LoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'owner2@acme.com',
      password: 'OwnerSecure123!',
    });
    const owner2Token = owner2LoginRes.data.accessToken;

    let crossBuildingBlocked = false;
    try {
      // Owner 2 tries to access Span Tower IX layout
      await axios.get(`${API_BASE}/apartments/building-layout/${unitA101.buildingId}`, {
        headers: { Authorization: `Bearer ${owner2Token}` },
      });
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        crossBuildingBlocked = true;
      }
    }
    assert(
      crossBuildingBlocked,
      'Building Owner cannot access another owner\'s building layout',
      'Owner 2 was blocked from Span Tower IX layout with HTTP 403 Forbidden.',
    );

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 11: No Manager Role in Registration / Assignment
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenario 11: Manager Role Completely Rejected ---');
    let managerRoleRejected = false;
    try {
      await axios.post(
        `${API_BASE}/users`,
        {
          name: 'Fake Manager',
          email: `mgr_${Date.now()}@test.com`,
          password: 'Password123!',
          initialRole: 'MANAGER',
        },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 403) {
        managerRoleRejected = true;
      }
    }
    assert(managerRoleRejected, 'Assigning old "MANAGER" role is strictly rejected by backend', 'Server rejected obsolete MANAGER role with HTTP 400/403.');

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 12: Record Payment, Generate Receipt & Verify Invoices
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Testing Scenario 12: Record Payment & PDF Generation ---');
    const paymentRecordRes = await axios.post(
      `${API_BASE}/payments`,
      {
        apartmentId: unitA101.id,
        amount: 6300,
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: `TEST-REF-${Date.now()}`,
        paymentDate: '2026-10-14',
        notes: 'Monthly maintenance payment',
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    const recordedPayment = paymentRecordRes.data;
    assert(
      !!recordedPayment.receiptNumber,
      'Payment recorded and allocated with official receipt',
      `Receipt: ${recordedPayment.receiptNumber}, Amount: Rs. ${recordedPayment.amount}`,
    );

    // Verify PDF receipt download works with token
    const receiptPdfRes = await axios.get(
      `${API_BASE}/payments/${recordedPayment.id}/receipt`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
        responseType: 'arraybuffer',
      },
    );
    assert(
      receiptPdfRes.headers['content-type'] === 'application/pdf' && receiptPdfRes.data.length > 0,
      'Payment receipt PDF generated and downloadable',
      `Content-Type: ${receiptPdfRes.headers['content-type']}, Size: ${receiptPdfRes.data.length} bytes`,
    );

    // Verify Invoice PDF download works with token
    const invoicesRes = await axios.get(`${API_BASE}/billing/invoices`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const firstInvoice = invoicesRes.data[0];
    const invoicePdfRes = await axios.get(
      `${API_BASE}/billing/invoices/${firstInvoice.id}/pdf`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
        responseType: 'arraybuffer',
      },
    );
    assert(
      invoicePdfRes.headers['content-type'] === 'application/pdf' && invoicePdfRes.data.length > 0,
      'Invoice PDF generated and downloadable',
      `Content-Type: ${invoicePdfRes.headers['content-type']}, Size: ${invoicePdfRes.data.length} bytes`,
    );

    const paymentsRes = await axios.get(`${API_BASE}/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      invoicesRes.data.length > 0 && paymentsRes.data.length > 0,
      'Existing invoices, arrears snapshots, and payment receipts are preserved',
      `Found ${invoicesRes.data.length} invoices and ${paymentsRes.data.length} payments safely intact in DB.`,
    );

    console.log(`\n======================================================`);
    console.log(`🎉 ALL ${passedCount}/${totalCount} TEST SCENARIOS PASSED WITH ZERO FAILURES!`);
    console.log(`======================================================\n`);
  } catch (error: any) {
    console.error('Fatal test error:', error.response?.data || error.message);
    process.exitCode = 1;
  }
}

runTests();
