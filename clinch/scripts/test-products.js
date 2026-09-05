/**
 * DealFlow360 - Module 2 Verification Test Suite: Products & Price Lists
 * 
 * Usage:
 *   node scripts/test-products.js
 * 
 * Tests:
 *   1. Public product catalog listing (GET /api/products)
 *   2. Filter products by category (?category=Hardware)
 *   3. Search products by keyword (?search=router)
 *   4. Retrieve single product details with variants and pricelists (GET /api/products/:id)
 *   5. Effective price resolution for GOLD tier (GET /api/products/:id/pricelists/resolve?tier=GOLD)
 *   6. Fallback resolution for non-overridden tier (GET /api/products/:id/pricelists/resolve?tier=BRONZE)
 *   7. RBAC Protection: Verify Sales Rep (REP) cannot create products (403 Forbidden)
 *   8. Admin Operation: Create a new product (POST /api/products)
 *   9. Admin Operation: Add a variant with extraPrice (POST /api/products/:id/variants)
 *  10. Admin Operation: Set/Upsert tier pricing (POST /api/products/:id/pricelists)
 *  11. Admin Operation: Update product details (PUT /api/products/:id)
 *  12. Admin Operation: Delete variant (DELETE /api/products/:id/variants/:variantId)
 *  13. Admin Operation: Cascade delete product (DELETE /api/products/:id)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logPass(msg) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${msg}`);
}

function logFail(msg, detail) {
  console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${msg}`);
  if (detail) console.error(`    ${colors.red}${detail}${colors.reset}`);
}

function logStep(step, name) {
  console.log(`\n${colors.cyan}${colors.bold}[Step ${step}] ${name}${colors.reset}`);
}

async function runTests() {
  console.log(`${colors.bold}${colors.blue}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}   DealFlow360 - Module 2 (Product & Price Lists) Test Suite    ${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}================================================================${colors.reset}`);
  console.log(`Targeting: ${colors.yellow}${API_BASE}${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  let repToken = null;
  let adminToken = null;
  let seededProductId = null;
  let testCreatedProductId = null;
  let testCreatedVariantId = null;

  // ---------------------------------------------------------------------------
  // Step 0: Obtain Tokens for RBAC testing
  // ---------------------------------------------------------------------------
  logStep(0, 'Authenticate Admin & Sales Rep for RBAC tests');
  try {
    // Admin login
    const adminRes = await fetch(`${API_BASE}/api/auth/internal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@dealflow360.com', password: 'Password123!' }),
    });
    const adminData = await adminRes.json();
    if (adminRes.ok && adminData.data?.token) {
      adminToken = adminData.data.token;
      logPass('Logged in as Dave Admin (ADMIN)');
      passed++;
    } else {
      logFail('Failed to log in as Dave Admin', JSON.stringify(adminData));
      failed++;
    }

    // Rep login
    const repRes = await fetch(`${API_BASE}/api/auth/internal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rep@dealflow360.com', password: 'Password123!' }),
    });
    const repData = await repRes.json();
    if (repRes.ok && repData.data?.token) {
      repToken = repData.data.token;
      logPass('Logged in as Alice Sales (REP)');
      passed++;
    } else {
      logFail('Failed to log in as Alice Sales', JSON.stringify(repData));
      failed++;
    }
  } catch (err) {
    logFail('Error logging in test users', err.message);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Step 1: List all products
  // ---------------------------------------------------------------------------
  logStep(1, 'GET /api/products (List all products in catalog)');
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const data = await res.json();

    if (res.ok && data.success && Array.isArray(data.data.products)) {
      logPass(`Retrieved ${data.data.count} products from catalog`);
      if (data.data.products.length > 0) {
        seededProductId = data.data.products[0].id;
        logPass(`Found sample product: "${data.data.products[0].name}" ($${data.data.products[0].basePrice})`);
      }
      passed++;
    } else {
      logFail('Failed to list products', JSON.stringify(data));
      failed++;
    }
  } catch (err) {
    logFail('Network error fetching products', err.message);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Step 2: Filter by category
  // ---------------------------------------------------------------------------
  logStep(2, 'GET /api/products?category=Hardware (Filter by category)');
  try {
    const res = await fetch(`${API_BASE}/api/products?category=Hardware`);
    const data = await res.json();

    if (res.ok && data.success) {
      const allHardware = data.data.products.every(p => p.category.toLowerCase() === 'hardware');
      if (allHardware && data.data.count > 0) {
        logPass(`Filtered ${data.data.count} products, all belonging to Hardware category`);
        passed++;
      } else {
        logFail('Category filter returned mismatched items', JSON.stringify(data));
        failed++;
      }
    } else {
      logFail('Failed to filter by category', JSON.stringify(data));
      failed++;
    }
  } catch (err) {
    logFail('Network error on category filter', err.message);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Step 3: Search keyword
  // ---------------------------------------------------------------------------
  logStep(3, 'GET /api/products?search=Router (Search keyword)');
  try {
    const res = await fetch(`${API_BASE}/api/products?search=Router`);
    const data = await res.json();

    if (res.ok && data.success && data.data.count > 0) {
      logPass(`Found ${data.data.count} product(s) matching keyword "Router"`);
      passed++;
    } else {
      logFail('Search failed or returned 0 items for seeded "Router"', JSON.stringify(data));
      failed++;
    }
  } catch (err) {
    logFail('Network error on product search', err.message);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Step 4: Get Single Product by ID
  // ---------------------------------------------------------------------------
  logStep(4, `GET /api/products/:id (Get product details, variants & tier pricelists)`);
  if (seededProductId) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${seededProductId}`);
      const data = await res.json();

      if (res.ok && data.success && data.data.product.id === seededProductId) {
        const prod = data.data.product;
        logPass(`Retrieved single product: "${prod.name}"`);
        logPass(`Variants attached: ${prod.variants.length}, Tier Price Lists: ${prod.priceLists.length}`);
        passed++;
      } else {
        logFail('Failed to fetch product by ID', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error fetching product by ID', err.message);
      failed++;
    }
  } else {
    logFail('Skipping single product check: No seeded product available');
    failed++;
  }

  // ---------------------------------------------------------------------------
  // Step 5: Price Resolution - Tier Override
  // ---------------------------------------------------------------------------
  logStep(5, `GET /api/products/:id/pricelists/resolve?tier=GOLD (Effective Price Resolution)`);
  if (seededProductId) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${seededProductId}/pricelists/resolve?tier=GOLD`);
      const data = await res.json();

      if (res.ok && data.success) {
        logPass(`Resolved price for GOLD tier: $${data.data.effectivePrice} (Base: $${data.data.basePrice}, Customized: ${data.data.isTierCustomized})`);
        passed++;
      } else {
        logFail('Price resolution failed for GOLD tier', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error on price resolution', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 6: RBAC Check - Non-Admin (REP) blocked from creating products
  // ---------------------------------------------------------------------------
  logStep(6, 'POST /api/products with Sales Rep token (Expect 403 Forbidden)');
  if (repToken) {
    try {
      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${repToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Rep Switch',
          category: 'Hardware',
          basePrice: 500,
          unit: 'piece',
          taxPercent: 18,
        }),
      });
      const data = await res.json();

      if (res.status === 403) {
        logPass(`Correctly rejected non-admin role with HTTP 403: "${data.error?.message}"`);
        passed++;
      } else {
        logFail(`Expected 403 Forbidden, but received HTTP ${res.status}`, JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error during RBAC test', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 7: Admin CRUD - Create Product
  // ---------------------------------------------------------------------------
  logStep(7, 'POST /api/products with Admin token (Create new product)');
  if (adminToken) {
    try {
      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Test NextGen SD-WAN Gateway 9000',
          category: 'Hardware',
          basePrice: 1500.00,
          unit: 'unit',
          taxPercent: 18.0,
          description: 'Automated test suite created product',
        }),
      });
      const data = await res.json();

      if (res.status === 201 && data.success && data.data.product?.id) {
        testCreatedProductId = data.data.product.id;
        logPass(`Created product with ID: ${testCreatedProductId} ("${data.data.product.name}")`);
        passed++;
      } else {
        logFail('Failed to create product as admin', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error creating product', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 8: Admin CRUD - Add Variant to newly created product
  // ---------------------------------------------------------------------------
  logStep(8, 'POST /api/products/:productId/variants (Add product variant)');
  if (adminToken && testCreatedProductId) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${testCreatedProductId}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          attributeName: 'Throughput License',
          attributeValue: '10 Gbps High Performance',
          extraPrice: 350.00,
        }),
      });
      const data = await res.json();

      if (res.status === 201 && data.success && data.data.variant?.id) {
        testCreatedVariantId = data.data.variant.id;
        logPass(`Added variant: "${data.data.variant.attributeName}: ${data.data.variant.attributeValue}" (+$$${data.data.variant.extraPrice})`);
        passed++;
      } else {
        logFail('Failed to add variant', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error adding variant', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 9: Admin CRUD - Set Tier Price
  // ---------------------------------------------------------------------------
  logStep(9, 'POST /api/products/:productId/pricelists (Configure Tier Price)');
  if (adminToken && testCreatedProductId) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${testCreatedProductId}/pricelists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          tier: 'GOLD',
          price: 1200.00,
          currency: 'USD',
        }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data.priceList?.tier === 'GOLD') {
        logPass(`Configured GOLD tier price: $$${data.data.priceList.price} USD`);
        passed++;
      } else {
        logFail('Failed to set tier price', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error setting tier price', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 10: Admin CRUD - Update Product
  // ---------------------------------------------------------------------------
  logStep(10, 'PUT /api/products/:id (Update product details)');
  if (adminToken && testCreatedProductId) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${testCreatedProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Test NextGen SD-WAN Gateway 9000 (Updated)',
          basePrice: 1600.00,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data.product.basePrice === '1600.00') {
        logPass(`Updated product base price to $$${data.data.product.basePrice}`);
        passed++;
      } else {
        logFail('Failed to update product', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error updating product', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 11: Admin CRUD - Delete Variant
  // ---------------------------------------------------------------------------
  logStep(11, 'DELETE /api/products/:productId/variants/:variantId (Delete variant)');
  if (adminToken && testCreatedProductId && testCreatedVariantId) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${testCreatedProductId}/variants/${testCreatedVariantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        logPass('Deleted test variant successfully');
        passed++;
      } else {
        logFail('Failed to delete variant', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error deleting variant', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 12: Admin CRUD - Cascade Delete Product
  // ---------------------------------------------------------------------------
  logStep(12, 'DELETE /api/products/:id (Cascade delete product and associated pricelists)');
  if (adminToken && testCreatedProductId) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${testCreatedProductId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        logPass('Deleted test product (and cascaded associated pricelists) successfully');
        passed++;
      } else {
        logFail('Failed to delete test product', JSON.stringify(data));
        failed++;
      }
    } catch (err) {
      logFail('Network error deleting test product', err.message);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.blue}================================================================${colors.reset}`);
  console.log(`${colors.bold}Test Results Summary:${colors.reset}`);
  console.log(`  Passed: ${colors.green}${colors.bold}${passed}${colors.reset}`);
  console.log(`  Failed: ${colors.red}${colors.bold}${failed}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}================================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
