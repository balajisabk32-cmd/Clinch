# Clinch (DealFlow360) Backend

Backend service for **Clinch (DealFlow360)**, an intelligent, self-governing B2B Sales Operations Platform.

This repository houses:
- **Authentication & RBAC**: Internal role-based access (`REP`, `MANAGER`, `FINANCE`, `ADMIN`) & Customer Portal magic link authentication.
- **Product Catalog & Price Lists**: Tier-aware pricing rules (`BRONZE`, `SILVER`, `GOLD`) and variant add-ons.
- **Discount Tier & Approval Chain Configuration**: Blended discount risk ceilings and role escalations.
- **Approval Routing State Machine**: Quotation workflow engine integrating intelligence scoring and audit logging.
- **Reporting & Dashboard Backend**: Deal Health aggregations, stalled deals, at-risk deals, and demo datasets.

---

## 🛠 Tech Stack

- **Runtime**: Node.js (Express REST API)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JSON Web Tokens (JWT) & bcryptjs
- **Validation**: Zod
- **Config**: dotenv, cors

---

## 📁 Project Structure

```text
/prisma
  schema.prisma           # Prisma data models & migrations
  seed.js                 # Database seed script for test users, customers & products
/src
  /config                 # Database connection (Prisma) & environment loading
  /middleware             # Auth guards (internal & customer), error handler, request logger
  /modules
    /auth                 # Internal staff & customer portal authentication
    /products             # Products catalog & variants
    /pricelists           # Tier-based price lists
    /discount-tiers       # Discount ceilings per tier & category
    /approval-chains      # Approval threshold configurations
    /approvals            # State machine workflow & audit trail
  /routes                 # Reporting & seed data routes
  /services               # Reporting aggregation services
  /utils                  # Response helpers & custom AppError classes
  app.js                  # Express application setup
  server.js               # Server entry point & graceful shutdown
/docs                     # Architecture diagrams, demo scripts, API specs
/public                   # Deal Health Dashboard web UI
/seed                     # Seed data generators
.env.example              # Environment variables template
package.json
README.md
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default parameters in `.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dealflow360?schema=public"
JWT_SECRET="dealflow360_super_secret_jwt_key_change_in_production"
JWT_EXPIRES_IN="7d"
```

### 3. Database & Migrations
Sync schema to PostgreSQL:
```bash
npx prisma db push
npm run prisma:generate
```

Seed default internal staff, B2B customers, and product catalog:
```bash
npm run prisma:seed
```

### 4. Start the Application
Run in development mode (with hot reloading):
```bash
npm run dev
```
Or start in standard mode:
```bash
npm start
```

To run the Reporting & Dashboard service on port 4000:
```bash
npm run start:reporting
```

---

## 🔐 Authentication API Documentation

All endpoints accept and return JSON. Endpoints are accessible via `/api/auth/...` or `/api/v1/auth/...`.

### 👥 Pre-seeded Credentials (Ready for Demo)

| Name | Email | Password | Role / Tier | Type |
|---|---|---|---|---|
| Alice Sales | `rep@dealflow360.com` | `Password123!` | `REP` | Internal |
| Bob Manager | `manager@dealflow360.com` | `Password123!` | `MANAGER` | Internal |
| Carol Finance | `finance@dealflow360.com` | `Password123!` | `FINANCE` | Internal |
| Dave Admin | `admin@dealflow360.com` | `Password123!` | `ADMIN` | Internal |
| John Acme | `customer@acmecorp.com` | *Magic Link* | `GOLD` | Customer (Acme Corp) |
| Sarah Beta | `procurement@betaindustries.com` | *Magic Link* | `SILVER` | Customer (Beta Industries) |
| David Delta | `contact@deltatech.io` | *Magic Link* | `BRONZE` | Customer (Delta Tech) |

---

### 1. Internal Staff Authentication (`/api/auth/internal`)

#### `POST /api/auth/internal/signup`
Create a new internal staff member (`REP`, `MANAGER`, `FINANCE`, `ADMIN`).

**Request Body**:
```json
{
  "name": "Nithin Sales",
  "email": "nithin@dealflow360.com",
  "password": "Password123!",
  "role": "REP"
}
```

#### `POST /api/auth/internal/login`
Authenticate internal staff member.

**Request Body**:
```json
{
  "email": "rep@dealflow360.com",
  "password": "Password123!"
}
```

#### `GET /api/auth/internal/me`
Retrieve currently authenticated internal user profile. Requires `Authorization: Bearer <internal_token>`.

---

### 2. Customer Portal Authentication (`/api/auth/customer`)

#### `POST /api/auth/customer/register`
Self-register a new customer account (public endpoint). Useful for self-service onboarding and demo testing.

**Request Body**:
```json
{
  "name": "Elena Rostova",
  "email": "elena@apexcloud.io",
  "companyName": "Apex Cloud Solutions",
  "tier": "GOLD"
}
```

#### `POST /api/auth/customer/request-magic-link`
Generate a 15-minute secure magic link.

**Request Body**:
```json
{
  "email": "customer@acmecorp.com"
}
```

#### `POST /api/auth/customer/verify-magic-link`
Verify magic link token and receive a customer-scoped JWT.

**Request Body**:
```json
{
  "token": "f48db6efd64bc86ef3f70624ebfc79b2fa9f7431e67e3df3dfcbef949b251347"
}
```

#### `GET /api/auth/customer/me`
Retrieve currently authenticated customer profile. Requires `Authorization: Bearer <customer_token>`.

---

## 📦 Products & Price Lists API Documentation

All endpoints are accessible via `/api/products/...` or `/api/v1/products/...`. Write operations require an Internal Staff token with role `ADMIN`.

### 1. Product Catalog Endpoints (`/api/products`)

- `GET /api/products` — List all products (supports query filters `?category=Hardware` and `?search=router`).
- `GET /api/products/:id` — Get single product details with variants and tier pricing.
- `POST /api/products` (Admin Only) — Create a new product.
- `PUT /api/products/:id` (Admin Only) — Update product fields.
- `DELETE /api/products/:id` (Admin Only) — Delete product (cascades variants and price lists).

### 2. Product Variants Endpoints (`/api/products/:productId/variants`)

- `POST /api/products/:productId/variants` (Admin Only) — Add variant with `extraPrice`.
- `GET /api/products/:productId/variants` — List variants for product.
- `DELETE /api/products/:productId/variants/:variantId` (Admin Only) — Delete variant.

### 3. Tier Price Lists & Resolution (`/api/products/:productId/pricelists`)

- `POST /api/products/:productId/pricelists` (Admin Only) — Set tier price (`BRONZE`, `SILVER`, `GOLD`).
- `GET /api/products/:productId/pricelists` — Get all tier prices configured for a product.
- `GET /api/products/:productId/pricelists/resolve?tier=GOLD` — **Quotation Builder Engine Helper**: Returns the tier price if configured; otherwise seamlessly falls back to `basePrice`.

---

## 📊 Reporting & Dashboard APIs (Port 4000)

- `GET /api/reports/deal-health-summary` — High-level summary of deal risks and health.
- `GET /api/reports/stalled-deals` — Stalled quotation alerts.
- `GET /api/reports/at-risk-deals` — Deals flagged with high discount or margin risks.
- `GET /api/reports/sales-rep-discount-history` — Rep historical discounting analysis.
- `GET /api/reports/deal-status-distribution` — Status breakdown.
- `GET /api/reports/dashboard` — Unified dashboard payload for Deal Health UI.
