# NITHIN'S MODULES &mdash; CLINCH (DEALFLOW360) ARCHITECTURE

**Author & Developer**: Nithin S J  
**Project**: Clinch (DealFlow360) &mdash; Intelligent B2B Sales Operations Platform  
**Modules Delivered**:
1. **`NITHIN_MODULE_1/`**: Authentication & Role-Based Access Control (RBAC) + Customer Portal Magic Link
2. **`NITHIN_MODULE_2/`**: Product Catalog, Variants & Tier-Aware Price Lists
3. **`NITHIN_MODULE_3/`**: Discount Tiers & Approval Chains Rules Engine

---

## 🗂️ Overview of Folders

```text
├── NITHIN_MODULE_1/
│   ├── prisma/schema_module1.prisma
│   ├── scripts/test-auth.js
│   ├── src/middleware/ (auth.js, authGuard.js)
│   ├── src/modules/auth/ (controller.js, routes.js, service.js, validation.js)
│   └── README.md
│
├── NITHIN_MODULE_2/
│   ├── prisma/schema_module2.prisma
│   ├── scripts/test-products.js
│   ├── src/modules/products/ (controller.js, routes.js, service.js, validation.js)
│   ├── src/modules/pricelists/ (controller.js, routes.js, service.js)
│   └── README.md
│
└── NITHIN_MODULE_3/
    ├── prisma/schema_module3.prisma
    ├── scripts/test-module3.js
    ├── src/modules/discount-tiers/ (controller.js, routes.js, service.js, validation.js)
    ├── src/modules/category-discount-limits/ (routes.js)
    ├── src/modules/approval-chains/ (controller.js, routes.js, service.js, validation.js)
    └── README.md
```

---

## 🔗 How the 3 Modules Interconnect

1. **Authentication (Module 1) secures Configuration (Modules 2 & 3)**:
   - Only users with `type === "internal"` and `role === "ADMIN"` can configure product base prices, tier price overrides, discount limits, and approval chain rules.
   - Sales Reps, Managers, and Finance staff are granted read access to catalog and policy configurations.
   - Customer Portal users (`type === "customer"`) authenticate via passwordless 15-minute magic links and are completely isolated from internal margin rules.

2. **Customer Tier (Module 1) drives Tier Pricing (Module 2) & Discount Limits (Module 3)**:
   - When customer `Acme Corp` logs in, their assigned tier (`GOLD`) automatically activates:
     - Pre-negotiated Gold tier prices via `GET /api/products/:productId/pricelists/resolve?tier=GOLD`.
     - Customer tier ceiling check via `GET /api/discount-tiers/GOLD` (max 15%).

3. **Quote Creation Workflow (Connecting Modules 2 & 3)**:
   - When a Sales Rep selects a product and proposes an extra discount, Module 3's resolver endpoint (`GET /api/approval-chains/resolve?discountPercent=X`) determines the governance workflow:
     - `0% - 9.99%`: Auto-Approved
     - `10% - 19.99%`: Sales Manager Sign-off Required
     - `20%+`: Dual Sign-off Required (Sales Manager + Finance)

---

## 🧪 Comprehensive Automated Test Suites

All 3 modules include self-contained automated test scripts:
```bash
# Test Module 1 (Auth, RBAC, Magic Links, Security Tampering)
node NITHIN_MODULE_1/scripts/test-auth.js

# Test Module 2 (Catalog, Variants, Tier Price Lists, Quotation Resolver)
node NITHIN_MODULE_2/scripts/test-products.js

# Test Module 3 (Seed Data, 5%/15%/25% Resolvers, Non-Admin 403, Overlap Rejection)
node NITHIN_MODULE_3/scripts/test-module3.js
```
