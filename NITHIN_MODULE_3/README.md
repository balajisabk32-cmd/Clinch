# NITHIN'S MODULE 3: Discount Tiers & Approval Chains

**Developer**: Nithin S J  
**Module**: Module 3 &mdash; Discount Ceilings, Governance Policies & Multi-Level Approval State Machine Resolver

---

## 📌 Architecture Overview

Module 3 delivers the enterprise discounting governance and approval state machine rules engine:
1. **Customer Tier Discount Limits (`TierDiscountLimit`)**:
   - Hard ceilings per customer account level (`BRONZE = 5%`, `SILVER = 10%`, `GOLD = 15%`).
   - Unique constraint per tier enforces clean 1-to-1 upsert semantics.
2. **Product Category Discount Limits (`CategoryDiscountLimit`)**:
   - Line-item specific ceilings checked across categories (`Hardware = 15%`, `Services = 10%`, `Subscriptions = 12%`).
   - Can be stricter or looser than tier limits, providing product margin defense.
3. **Approval Chain Rules (`ApprovalChainRule`)**:
   - Threshold-driven escalation engine:
     - `0.00% – 9.99%`: Auto-Approved (Self-Serve Sales Rep)
     - `10.00% – 19.99%`: Level 1 Escalation &rarr; Sales Manager Required
     - `20.00% – 100.00%`: Level 2 Escalation &rarr; Dual Signoff (Manager + Finance Required)
   - **Range Overlap Algorithm**: Validates that no two rules overlap ($\max(A_{min}, B_{min}) \le \min(A_{max}, B_{max})$) and rejects conflicts with `400 Bad Request` (`RANGE_OVERLAP`).
4. **Approval State Machine Helper Endpoint**:
   - `GET /api/approval-chains/resolve?discountPercent=18`
   - Returns `{ requiresManagerApproval: true, requiresFinanceApproval: false }` for instantaneous quote workflow routing.

---

## 📁 Module 3 Directory Structure

```text
NITHIN_MODULE_3/
├── prisma/
│   └── schema_module3.prisma             # TierDiscountLimit, CategoryDiscountLimit, ApprovalChainRule
├── scripts/
│   └── test-module3.js                   # 19 automated test cases covering seeds, resolver, RBAC, overlaps
├── src/
│   └── modules/
│       ├── discount-tiers/
│       │   ├── controller.js             # Upsert, list, get single tier limit
│       │   ├── routes.js                 # /api/discount-tiers routes
│       │   ├── service.js                # Prisma tier & category persistence
│       │   └── validation.js             # Zod tier & category validation
│       ├── category-discount-limits/
│       │   └── routes.js                 # /api/category-discount-limits routes
│       └── approval-chains/
│           ├── controller.js             # Rule CRUD & /resolve handler
│           ├── routes.js                 # /api/approval-chains routes
│           ├── service.js                # Overlap collision detection & resolve lookup
│           └── validation.js             # Rule ranges & boundary validation
└── README.md
```

---

## 📡 API Endpoints

### Customer Tier Discount Limits (`/api/discount-tiers`)
- `GET /api/discount-tiers` &mdash; List all customer tier discount limits.
- `GET /api/discount-tiers/:tier` &mdash; Get limit for one tier (e.g. `GET /api/discount-tiers/GOLD`).
- `POST /api/discount-tiers` (Admin Only) &mdash; Upsert tier limit.

### Category Discount Limits (`/api/category-discount-limits`)
- `GET /api/category-discount-limits` &mdash; List all category discount limits.
- `GET /api/category-discount-limits/:category` &mdash; Get limit for one category.
- `POST /api/category-discount-limits` (Admin Only) &mdash; Upsert category limit.

### Approval Chains (`/api/approval-chains`)
- `GET /api/approval-chains` &mdash; List all rules ordered by `minDiscountPercent ASC`.
- `GET /api/approval-chains/:id` &mdash; Get rule by ID.
- `POST /api/approval-chains` (Admin Only) &mdash; Create rule with overlap check.
- `PUT /api/approval-chains/:id` (Admin Only) &mdash; Update rule.
- `DELETE /api/approval-chains/:id` (Admin Only) &mdash; Delete rule.
- `GET /api/approval-chains/resolve?discountPercent=18` &mdash; Helper endpoint resolving required approvals.

---

## 🧪 Testing Module 3

Run the automated test suite:
```bash
node scripts/test-module3.js
```
Or interactively test on the web client at `http://localhost:5000/` under **🎯 Module 3: Discount Tiers & Rules**.
