const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json();
  return { status: response.status, body };
}

async function runTests() {
  console.log('🚀 Starting Comprehensive DealFlow360 Auth Test Suite\n');
  let passed = 0;
  let failed = 0;

  function record(desc, condition, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Healthcheck
    // -------------------------------------------------------------------------
    console.log('--- Phase 1: Server Health ---');
    const health = await request('/health');
    record('GET /health returns 200 { status: "ok" }', health.status === 200 && health.body.status === 'ok');

    // -------------------------------------------------------------------------
    // Test 2: Internal User Signup
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 2: Internal Staff Auth Flow ---');
    const randomSuffix = Date.now();
    const testUser = {
      name: 'Nithin Test',
      email: `nithin.${randomSuffix}@dealflow360.com`,
      password: 'StrongPassword123!',
      role: 'REP',
    };

    const signupRes = await request('/api/auth/internal/signup', {
      method: 'POST',
      body: JSON.stringify(testUser),
    });

    record(
      'POST /api/auth/internal/signup returns 201 with JWT',
      signupRes.status === 201 && signupRes.body.success === true && !!signupRes.body.data.token
    );

    record(
      'Signup response does NOT leak passwordHash',
      signupRes.body.data.user.passwordHash === undefined && signupRes.body.data.user.email === testUser.email
    );

    const signupToken = signupRes.body.data.token;

    // -------------------------------------------------------------------------
    // Test 3: Internal User Login
    // -------------------------------------------------------------------------
    const loginRes = await request('/api/auth/internal/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    record(
      'POST /api/auth/internal/login returns 200 with JWT',
      loginRes.status === 200 && loginRes.body.success === true && !!loginRes.body.data.token
    );

    record(
      'Login response does NOT leak passwordHash',
      loginRes.body.data.user.passwordHash === undefined
    );

    const internalToken = loginRes.body.data.token;

    // -------------------------------------------------------------------------
    // Test 4: Internal User /me Endpoint
    // -------------------------------------------------------------------------
    const meInternalRes = await request('/api/auth/internal/me', {
      headers: { Authorization: `Bearer ${internalToken}` },
    });

    record(
      'GET /api/auth/internal/me returns user profile',
      meInternalRes.status === 200 &&
        meInternalRes.body.data.user.email === testUser.email &&
        meInternalRes.body.data.user.role === 'REP'
    );

    record(
      'Internal /me response does NOT leak passwordHash',
      meInternalRes.body.data.user.passwordHash === undefined
    );

    // -------------------------------------------------------------------------
    // Test 5: Customer Self-Registration & Magic Link Flow
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 3: Customer Portal Self-Registration & Magic Link Flow ---');
    const custRandom = Date.now();
    const customerEmail = `enterprise.${custRandom}@cyberdyne.io`;

    // 5a. Customer Self-Registration
    const custRegRes = await request('/api/auth/customer/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Miles Dyson',
        email: customerEmail,
        companyName: 'Cyberdyne Systems',
        tier: 'GOLD',
      }),
    });

    record(
      'POST /api/auth/customer/register returns 201 with customer object',
      custRegRes.status === 201 &&
        custRegRes.body.success === true &&
        custRegRes.body.data.customer.companyName === 'Cyberdyne Systems' &&
        custRegRes.body.data.customer.tier === 'GOLD'
    );

    // 5b. Duplicate Customer Registration (should fail with 409)
    const custDupRes = await request('/api/auth/customer/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Miles Dyson Clone',
        email: customerEmail,
        companyName: 'Cyberdyne Systems',
        tier: 'SILVER',
      }),
    });

    record(
      'POST /api/auth/customer/register duplicate email returns 409 Conflict',
      custDupRes.status === 409 &&
        custDupRes.body.error.code === 'CUSTOMER_ALREADY_EXISTS'
    );

    const magicReqRes = await request('/api/auth/customer/request-magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: customerEmail }),
    });

    record(
      'POST /api/auth/customer/request-magic-link returns 200 with token',
      magicReqRes.status === 200 &&
        magicReqRes.body.success === true &&
        !!magicReqRes.body.data.token
    );

    const magicToken = magicReqRes.body.data.token;

    // Verify the magic link token
    const magicVerifyRes = await request('/api/auth/customer/verify-magic-link', {
      method: 'POST',
      body: JSON.stringify({ token: magicToken }),
    });

    record(
      'POST /api/auth/customer/verify-magic-link returns customer profile and customer JWT',
      magicVerifyRes.status === 200 &&
        magicVerifyRes.body.success === true &&
        magicVerifyRes.body.data.customer.companyName === 'Cyberdyne Systems' &&
        magicVerifyRes.body.data.customer.tier === 'GOLD' &&
        !!magicVerifyRes.body.data.token
    );

    const customerToken = magicVerifyRes.body.data.token;

    // Replay attack: try using the exact same magic link token again
    const magicReplayRes = await request('/api/auth/customer/verify-magic-link', {
      method: 'POST',
      body: JSON.stringify({ token: magicToken }),
    });

    record(
      'Reusing consumed magic link token returns 400 Bad Request (TOKEN_ALREADY_USED)',
      magicReplayRes.status === 400 && magicReplayRes.body.error.code === 'TOKEN_ALREADY_USED'
    );

    // Customer /me endpoint
    const meCustomerRes = await request('/api/auth/customer/me', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });

    record(
      'GET /api/auth/customer/me returns customer profile',
      meCustomerRes.status === 200 &&
        meCustomerRes.body.data.customer.email === customerEmail &&
        meCustomerRes.body.data.customer.tier === 'GOLD'
    );

    // -------------------------------------------------------------------------
    // Test 6: Cross-Boundary Token Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 4: Token Type Isolation & Security ---');

    // Internal token used on Customer-only endpoint
    const crossInternalToCustomer = await request('/api/auth/customer/me', {
      headers: { Authorization: `Bearer ${internalToken}` },
    });

    record(
      'Internal staff token FAILS on customer-only route (403 Forbidden)',
      crossInternalToCustomer.status === 403 &&
        crossInternalToCustomer.body.error.message.includes('Customer portal token required')
    );

    // Customer token used on Internal staff endpoint
    const crossCustomerToInternal = await request('/api/auth/internal/me', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });

    record(
      'Customer token FAILS on internal staff route (403 Forbidden)',
      crossCustomerToInternal.status === 403 &&
        crossCustomerToInternal.body.error.message.includes('Internal staff token required')
    );

    // Unauthenticated request (no token)
    const unauthRes = await request('/api/auth/internal/me');
    record(
      'Unauthenticated request returns 401 Unauthorized',
      unauthRes.status === 401 && unauthRes.body.success === false
    );

    // -------------------------------------------------------------------------
    // Test 7: Role Authorization Guard (REP vs MANAGER)
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 5: Role-based Authorization Guard ---');

    // REP attempts to access manager-only route
    const repRoleRes = await request('/api/auth/internal/manager-only', {
      headers: { Authorization: `Bearer ${internalToken}` }, // REP
    });

    record(
      'REP user blocked from manager-only route (403 Forbidden)',
      repRoleRes.status === 403 && repRoleRes.body.error.message.includes('Forbidden')
    );

    // Login as seeded Manager
    const managerLogin = await request('/api/auth/internal/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'manager@dealflow360.com',
        password: 'Password123!',
      }),
    });

    const managerToken = managerLogin.body.data.token;

    const managerRoleRes = await request('/api/auth/internal/manager-only', {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    record(
      'MANAGER user successfully accesses manager-only route (200 OK)',
      managerRoleRes.status === 200 && managerRoleRes.body.success === true
    );

    // -------------------------------------------------------------------------
    // Test 8: Input Validation Errors
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 6: Input Validation ---');

    const invalidSignup = await request('/api/auth/internal/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Input',
        email: 'not-an-email',
        password: '123', // Too short
        role: 'SUPER_USER', // Invalid role enum
      }),
    });

    record(
      'Invalid signup payload returns 400 Bad Request with VALIDATION_ERROR',
      invalidSignup.status === 400 && invalidSignup.body.error.code === 'VALIDATION_ERROR'
    );

    // -------------------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------------------
    console.log('\n=========================================');
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('=========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error running test suite:', err);
    process.exit(1);
  }
}

runTests();
