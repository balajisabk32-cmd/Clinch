# NITHIN'S MODULE 2: Product Catalog & Tier-Aware Price Lists

**Developer**: Nithin S J  
**Module**: Module 2 &mdash; Enterprise Catalog, Product Variants & Tier Pricing Rules

---

## 📌 Architecture Overview

Module 2 provides the core commercial product pricing engine for Clinch (DealFlow360):
1. **Master Product Catalog**:
   - Products across IT & Networking categories (`Hardware`, `Services`, `Subscriptions`).
   - Base prices, units, and tax calculations.
   - Admin-only write controls (`authenticateInternal + authorizeRoles("ADMIN")`).
2. **Product Variants**:
   - Configurable add-on attributes (e.g., Port configurations, PoE power budgets, NPU acceleration).
   - Dynamic `extraPrice` additions applied directly to the line item cost.
3. **Tier-Aware Price Lists (`PriceList`)**:
   - Customer-tier pricing overrides (`BRONZE`, `SILVER`, `GOLD`).
   - Unique composite constraint: `[productId, tier]` guarantees exact 1-to-1 pricing.
4. **Quotation Builder Engine Fallback**:
   - `/api/products/:productId/pricelists/resolve?tier=GOLD`
   - Checks for a tier-negotiated rate; if none is configured, gracefully falls back to the product's `basePrice`.

---

## 📁 Module 2 Directory Structure

```text
NITHIN_MODULE_2/
├── prisma/
│   └── schema_module2.prisma    # Product, ProductVariant, PriceList Prisma models
├── scripts/
│   └── test-products.js         # Automated product & pricing test suite
├── src/
│   └── modules/
│       ├── products/
│       │   ├── controller.js    # Catalog & variant CRUD operations
│       │   ├── routes.js        # /api/products and /:productId/variants
│       │   ├── service.js       # Filtering, search, variant association
│       │   └── validation.js    # Product & variant Zod validation
│       └── pricelists/
│           ├── controller.js    # Tier price configuration & resolve handlers
│           ├── routes.js        # /api/products/:productId/pricelists routes
│           └── service.js       # Tier price upsert & resolution logic
└── README.md
```

---

## 📡 API Endpoints

### Product Catalog (`/api/products`)
- `GET /api/products` &mdash; List catalog (supports query filters `?category=Hardware` and `?search=router`).
- `GET /api/products/:id` &mdash; Get single product details with variants and tier pricing.
- `POST /api/products` (Admin Only) &mdash; Create new product.
- `PUT /api/products/:id` (Admin Only) &mdash; Update product.
- `DELETE /api/products/:id` (Admin Only) &mdash; Delete product (cascades variants and price lists).

### Product Variants (`/api/products/:productId/variants`)
- `POST /api/products/:productId/variants` (Admin Only) &mdash; Add variant with `extraPrice`.
- `GET /api/products/:productId/variants` &mdash; List variants.
- `DELETE /api/products/:productId/variants/:variantId` (Admin Only) &mdash; Delete variant.

### Price Lists (`/api/products/:productId/pricelists`)
- `POST /api/products/:productId/pricelists` (Admin Only) &mdash; Upsert tier price (`BRONZE`, `SILVER`, `GOLD`).
- `GET /api/products/:productId/pricelists` &mdash; List all configured tier prices for product.
- `GET /api/products/:productId/pricelists/resolve?tier=GOLD` &mdash; Resolve negotiated tier price with fallback.

---

## 🧪 Testing Module 2

Run the automated test suite:
```bash
node scripts/test-products.js
```
Or interactively test on the web client at `http://localhost:5000/` under **📦 Module 2: Products & Price Lists**.
