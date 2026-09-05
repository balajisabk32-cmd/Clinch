# NITHIN'S MODULE 1: Authentication & Role-Based Access Control (RBAC) + Customer Portal

**Developer**: Nithin S J  
**Module**: Module 1 &mdash; Dual Authentication System (Internal Staff RBAC + Customer Portal Passwordless Magic Link)

---

## 📌 Architecture Overview

Module 1 implements a dual-surface enterprise authentication engine:
1. **Internal Staff RBAC**:
   - Roles: `ADMIN`, `MANAGER`, `FINANCE`, `REP`.
   - Credentials-based JWT auth (bcryptjs 10 rounds).
   - Role guard middleware `authorizeRoles("ADMIN", ...)` and token type enforcement `type === "internal"`.
2. **External Customer Portal**:
   - Passwordless 15-minute secure Magic Link flow (`crypto.randomBytes(32)` hashed with SHA-256).
   - Self-service customer registration with tier assignment (`BRONZE`, `SILVER`, `GOLD`).
   - Customer-scoped JWT (`type === "customer"`).
   - Cross-token tamper protection: Staff tokens cannot access Customer endpoints, and Customer tokens cannot access Staff endpoints (`403 Forbidden`).

---

## 📁 Module 1 Directory Structure

```text
NITHIN_MODULE_1/
├── prisma/
│   └── schema_module1.prisma    # User, Customer, MagicLinkToken Prisma models
├── scripts/
│   └── test-auth.js             # Automated auth test suite
├── src/
│   ├── middleware/
│   │   ├── auth.js              # authenticateInternal, authenticateCustomer, authorizeRoles
│   │   └── authGuard.js         # requireAuth, requireRole helpers
│   └── modules/
│       └── auth/
│           ├── controller.js    # signup, login, customer registration, magic link handlers
│           ├── routes.js        # /api/auth/internal/* and /api/auth/customer/* routes
│           ├── service.js       # JWT generation, bcrypt verification, magic token validation
│           └── validation.js    # Zod request validation schemas
└── README.md
```

---

## 📡 API Endpoints

### Internal Staff Auth (`/api/auth/internal` & `/api/auth/login`)
- `POST /api/auth/internal/signup` &mdash; Register internal staff member.
- `POST /api/auth/internal/login` (or `POST /api/auth/login`) &mdash; Authenticate staff, returns JWT.
- `GET /api/auth/internal/me` &mdash; Get current staff user profile.
- `GET /api/auth/internal/manager-only` &mdash; Protected endpoint for Manager/Admin.

### Customer Portal Auth (`/api/auth/customer`)
- `POST /api/auth/customer/register` &mdash; Self-register customer with company name and tier.
- `POST /api/auth/customer/request-magic-link` &mdash; Request a 15-minute secure one-time login link.
- `POST /api/auth/customer/verify-magic-link` &mdash; Exchange magic link token for customer JWT.
- `GET /api/auth/customer/me` &mdash; Retrieve customer profile.

---

## 🧪 Testing Module 1

Run the automated test suite:
```bash
node scripts/test-auth.js
```
Or interactively test on the web client at `http://localhost:5000/` under **🔐 Module 1: Auth & Customer Portal**.
