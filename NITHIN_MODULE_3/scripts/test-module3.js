const BASE_URL = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // non-json response
  }

  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🧪 Starting Module 3 Automated Test Suite...\n');
  const results = [];

  function record(testName, passed, details = '') {
    results.push({ testName, passed, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${testName}${details ? ` (${details})` : ''}`);
  }

  try {
    // -------------------------------------------------------------
    // Step 0: Auth Tokens
    // -------------------------------------------------------------
    console.log('--- Phase 0: Authenticating Users ---');
    const adminLoginRes = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: {
        email: 'admin@dealflow360.com',
        password: 'Password123!',
      },
    });
    const adminToken = adminLoginRes.data.data.token;
    const adminAuthHeader = { Authorization: `Bearer ${adminToken}` };

    const repLoginRes = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: {
        email: 'rep@dealflow360.com',
        password: 'Password123!',
      },
    });
    const repToken = repLoginRes.data.data.token;
    const repAuthHeader = { Authorization: `Bearer ${repToken}` };

    record('Authenticate Admin & Sales Rep', adminLoginRes.ok && repLoginRes.ok, 'Tokens obtained successfully');

    // -------------------------------------------------------------
    // Step 1: Verify Seed Data via GET Endpoints
    // -------------------------------------------------------------
    console.log('\n--- Phase 1: Verifying Seed Data via GET Endpoints ---');

    // 1.1 GET /api/discount-tiers
    const tierListRes = await request(`${BASE_URL}/discount-tiers`);
    const tiers = tierListRes.data.data;
    const bronze = tiers.find((t) => t.tier === 'BRONZE');
    const silver = tiers.find((t) => t.tier === 'SILVER');
    const gold = tiers.find((t) => t.tier === 'GOLD');

    const tiersCorrect =
      tiers.length === 3 &&
      Number(bronze?.maxDiscountPercent) === 5 &&
      Number(silver?.maxDiscountPercent) === 10 &&
      Number(gold?.maxDiscountPercent) === 15;

    record(
      'GET /api/discount-tiers returns seeded limits (Bronze=5%, Silver=10%, Gold=15%)',
      tiersCorrect,
      `Found ${tiers.length} tiers`
    );

    // 1.2 GET /api/discount-tiers/:tier
    const singleTierRes = await request(`${BASE_URL}/discount-tiers/GOLD`);
    const singleGold = singleTierRes.data.data;
    record(
      'GET /api/discount-tiers/GOLD returns Gold limit',
      singleGold.tier === 'GOLD' && Number(singleGold.maxDiscountPercent) === 15,
      `maxDiscountPercent: ${singleGold.maxDiscountPercent}%`
    );

    // 1.3 GET /api/category-discount-limits
    const categoryListRes = await request(`${BASE_URL}/category-discount-limits`);
    const categories = categoryListRes.data.data;
    const hardware = categories.find((c) => c.category === 'Hardware');
    const services = categories.find((c) => c.category === 'Services');
    const subscriptions = categories.find((c) => c.category === 'Subscriptions');

    const categoriesCorrect =
      categories.length >= 3 &&
      Number(hardware?.maxDiscountPercent) === 15 &&
      Number(services?.maxDiscountPercent) === 10 &&
      Number(subscriptions?.maxDiscountPercent) === 12;

    record(
      'GET /api/category-discount-limits returns seeded limits (Hardware=15%, Services=10%, Subscriptions=12%)',
      categoriesCorrect,
      `Found ${categories.length} categories`
    );

    // 1.4 GET /api/category-discount-limits/:category
    const singleCategoryRes = await request(`${BASE_URL}/category-discount-limits/Hardware`);
    const singleHardware = singleCategoryRes.data.data;
    record(
      'GET /api/category-discount-limits/Hardware returns Hardware limit',
      singleHardware.category === 'Hardware' && Number(singleHardware.maxDiscountPercent) === 15,
      `maxDiscountPercent: ${singleHardware.maxDiscountPercent}%`
    );

    // 1.5 GET /api/approval-chains
    const rulesRes = await request(`${BASE_URL}/approval-chains`);
    const rules = rulesRes.data.data;
    const rulesOrdered =
      rules.length === 3 &&
      Number(rules[0].minDiscountPercent) <= Number(rules[1].minDiscountPercent) &&
      Number(rules[1].minDiscountPercent) <= Number(rules[2].minDiscountPercent);

    record(
      'GET /api/approval-chains lists rules ordered by minDiscountPercent ascending',
      rulesOrdered,
      `Rules count: ${rules.length}`
    );

    // -------------------------------------------------------------
    // Step 2: Call /approval-chains/resolve for discounts (5, 15, 25)
    // -------------------------------------------------------------
    console.log('\n--- Phase 2: Resolving Approval Requirements for Discounts ---');

    // 2.1 Discount = 5% (0 - 9.99%) -> No approval needed
    const resolve5 = await request(`${BASE_URL}/approval-chains/resolve?discountPercent=5`);
    const r5 = resolve5.data.data;
    const pass5 = r5.requiresManagerApproval === false && r5.requiresFinanceApproval === false;
    record(
      'Resolve 5% discount -> Manager: false, Finance: false',
      pass5,
      `Manager: ${r5.requiresManagerApproval}, Finance: ${r5.requiresFinanceApproval}`
    );

    // 2.2 Discount = 15% (10 - 19.99%) -> Manager only
    const resolve15 = await request(`${BASE_URL}/approval-chains/resolve?discountPercent=15`);
    const r15 = resolve15.data.data;
    const pass15 = r15.requiresManagerApproval === true && r15.requiresFinanceApproval === false;
    record(
      'Resolve 15% discount -> Manager: true, Finance: false',
      pass15,
      `Manager: ${r15.requiresManagerApproval}, Finance: ${r15.requiresFinanceApproval}`
    );

    // 2.3 Discount = 25% (20%+) -> Manager + Finance
    const resolve25 = await request(`${BASE_URL}/approval-chains/resolve?discountPercent=25`);
    const r25 = resolve25.data.data;
    const pass25 = r25.requiresManagerApproval === true && r25.requiresFinanceApproval === true;
    record(
      'Resolve 25% discount -> Manager: true, Finance: true',
      pass25,
      `Manager: ${r25.requiresManagerApproval}, Finance: ${r25.requiresFinanceApproval}`
    );

    // 2.4 Boundary resolution: 0%, 9.99%, 10%, 19.99%, 20%, 100%
    const res0 = (await request(`${BASE_URL}/approval-chains/resolve?discountPercent=0`)).data.data;
    const res999 = (await request(`${BASE_URL}/approval-chains/resolve?discountPercent=9.99`)).data.data;
    const res10 = (await request(`${BASE_URL}/approval-chains/resolve?discountPercent=10`)).data.data;
    const res1999 = (await request(`${BASE_URL}/approval-chains/resolve?discountPercent=19.99`)).data.data;
    const res20 = (await request(`${BASE_URL}/approval-chains/resolve?discountPercent=20`)).data.data;
    const res100 = (await request(`${BASE_URL}/approval-chains/resolve?discountPercent=100`)).data.data;

    const boundaryPass =
      !res0.requiresManagerApproval &&
      !res999.requiresManagerApproval &&
      res10.requiresManagerApproval &&
      !res10.requiresFinanceApproval &&
      res1999.requiresManagerApproval &&
      !res1999.requiresFinanceApproval &&
      res20.requiresManagerApproval &&
      res20.requiresFinanceApproval &&
      res100.requiresManagerApproval &&
      res100.requiresFinanceApproval;

    record('Resolve boundary discounts (0, 9.99, 10, 19.99, 20, 100%)', boundaryPass);

    // -------------------------------------------------------------
    // Step 3: Role Authorization - Non-Admin Forbidden (403)
    // -------------------------------------------------------------
    console.log('\n--- Phase 3: Testing Non-Admin Authorization Guard ---');

    // 3.1 Non-admin (REP) blocked on POST /api/discount-tiers
    const repTierRes = await request(`${BASE_URL}/discount-tiers`, {
      method: 'POST',
      headers: repAuthHeader,
      body: { tier: 'BRONZE', maxDiscountPercent: 8 },
    });
    record(
      'Non-admin blocked from POST /api/discount-tiers (403 Forbidden)',
      repTierRes.status === 403,
      `HTTP Status: ${repTierRes.status}`
    );

    // 3.2 Non-admin (REP) blocked on POST /api/category-discount-limits
    const repCatRes = await request(`${BASE_URL}/category-discount-limits`, {
      method: 'POST',
      headers: repAuthHeader,
      body: { category: 'Hardware', maxDiscountPercent: 20 },
    });
    record(
      'Non-admin blocked from POST /api/category-discount-limits (403 Forbidden)',
      repCatRes.status === 403,
      `HTTP Status: ${repCatRes.status}`
    );

    // 3.3 Non-admin (REP) blocked on POST /api/approval-chains
    const repChainRes = await request(`${BASE_URL}/approval-chains`, {
      method: 'POST',
      headers: repAuthHeader,
      body: {
        minDiscountPercent: 50,
        maxDiscountPercent: 60,
        requiresManagerApproval: true,
        requiresFinanceApproval: true,
      },
    });
    record(
      'Non-admin blocked from POST /api/approval-chains (403 Forbidden)',
      repChainRes.status === 403,
      `HTTP Status: ${repChainRes.status}`
    );

    // 3.4 Unauthenticated request blocked (401)
    const unauthRes = await request(`${BASE_URL}/discount-tiers`, {
      method: 'POST',
      body: { tier: 'BRONZE', maxDiscountPercent: 8 },
    });
    record(
      'Unauthenticated request blocked (401 Unauthorized)',
      unauthRes.status === 401,
      `HTTP Status: ${unauthRes.status}`
    );

    // -------------------------------------------------------------
    // Step 4: Range Overlap Validation (400 Bad Request)
    // -------------------------------------------------------------
    console.log('\n--- Phase 4: Overlapping Approval Chain Rule Validation ---');

    // 4.1 Attempt to create overlapping rule 15% - 25% (conflicts with 10-19.99% and 20-100%)
    const overlapRes = await request(`${BASE_URL}/approval-chains`, {
      method: 'POST',
      headers: adminAuthHeader,
      body: {
        minDiscountPercent: 15,
        maxDiscountPercent: 25,
        requiresManagerApproval: true,
        requiresFinanceApproval: false,
      },
    });
    const overlapErrorMessage = overlapRes.data?.error?.message || overlapRes.data?.message;
    record(
      'Overlapping range [15%, 25%] rejected with 400 Bad Request',
      overlapRes.status === 400,
      overlapErrorMessage
    );

    // 4.2 Attempt to create rule with min > max (e.g. 30% - 20%)
    const invertedRes = await request(`${BASE_URL}/approval-chains`, {
      method: 'POST',
      headers: adminAuthHeader,
      body: {
        minDiscountPercent: 30,
        maxDiscountPercent: 20,
        requiresManagerApproval: true,
        requiresFinanceApproval: false,
      },
    });
    record(
      'Inverted range [30%, 20%] rejected with 400 Bad Request',
      invertedRes.status === 400,
      `HTTP Status: ${invertedRes.status}`
    );

    // 4.3 Attempt discount percent > 100
    const outOfBoundsRes = await request(`${BASE_URL}/discount-tiers`, {
      method: 'POST',
      headers: adminAuthHeader,
      body: {
        tier: 'GOLD',
        maxDiscountPercent: 120,
      },
    });
    record(
      'Discount > 100% rejected with 400 Bad Request',
      outOfBoundsRes.status === 400,
      `HTTP Status: ${outOfBoundsRes.status}`
    );

    // -------------------------------------------------------------
    // Step 5: Admin CRUD & Upsert Behavior
    // -------------------------------------------------------------
    console.log('\n--- Phase 5: Admin Upsert & Configuration Flow ---');

    // 5.1 Admin upserts Tier limit
    const updateTierRes = await request(`${BASE_URL}/discount-tiers`, {
      method: 'POST',
      headers: adminAuthHeader,
      body: { tier: 'BRONZE', maxDiscountPercent: 6.5 },
    });
    const updatedBronze = updateTierRes.data?.data;
    const tierUpsertPass = updateTierRes.ok && Number(updatedBronze.maxDiscountPercent) === 6.5;

    // Revert back to 5.0
    await request(`${BASE_URL}/discount-tiers`, {
      method: 'POST',
      headers: adminAuthHeader,
      body: { tier: 'BRONZE', maxDiscountPercent: 5.0 },
    });
    record('Admin successfully updates Bronze tier discount to 6.5% and reverts to 5%', tierUpsertPass);

    // 5.2 Admin upserts Category limit
    const updateCategoryRes = await request(`${BASE_URL}/category-discount-limits`, {
      method: 'POST',
      headers: adminAuthHeader,
      body: { category: 'Hardware', maxDiscountPercent: 18.0 },
    });
    const updatedHardware = updateCategoryRes.data?.data;
    const categoryUpsertPass = updateCategoryRes.ok && Number(updatedHardware.maxDiscountPercent) === 18.0;

    // Revert back to 15.0
    await request(`${BASE_URL}/category-discount-limits`, {
      method: 'POST',
      headers: adminAuthHeader,
      body: { category: 'Hardware', maxDiscountPercent: 15.0 },
    });
    record('Admin successfully updates Hardware category discount to 18% and reverts to 15%', categoryUpsertPass);

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n=========================================');
    console.log('🏁 TEST RUN SUMMARY');
    console.log('=========================================');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log(`Total Tests : ${total}`);
    console.log(`Passed      : ${passed}`);
    console.log(`Failed      : ${failed}`);

    if (failed === 0) {
      console.log('\n🎉 ALL MODULE 3 TEST CASES PASSED SUCCESSFULLY!\n');
    } else {
      console.error(`\n⚠️ ${failed} TEST CASES FAILED!\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Unexpected test runner error:', err);
    process.exit(1);
  }
}

runTests();
