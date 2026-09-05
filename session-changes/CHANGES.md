# Session Changes — DealFlow360 (Clinch)
**Date:** 2026-09-06  
**Branch:** main

---

## Summary of Changes

This session introduced the **Customer Portal**, **Customer-to-Rep Assignment System**, and **Discount Risk Scoring Workflow** into the DealFlow360 platform.

---

## Modified Files

### Backend (`backend/`)
| File | Change |
|------|--------|
| `backend/api/routers.py` | Added `_sync_customer_portal_quotes`, `reassign_quote`, customer/rep assignment endpoints. Fixed SQL queries (removed non-existent `updated_at` column). |
| `backend/api/fixtures.py` | Updated seed data for new schema. |

### Frontend — Sales Rep Portal (`frontend/src/`)
| File | Change |
|------|--------|
| `frontend/src/lib/api.ts` | Added API methods: reassignment, reps list, customers list. |
| `frontend/src/pages/Quotations.tsx` | Added source badges and unassigned state display. |
| `frontend/src/pages/Approvals.tsx` | Implemented reassignment modal, queue filtering, manager hierarchy. |
| `frontend/src/pages/Builder.tsx` | Updated builder with new fields. |
| `frontend/src/pages/Login.tsx` | Improved login flow with role detection. |
| `frontend/src/components/Nav.tsx` | Removed Unified Hub button, added Customer Portal link. |
| `frontend/src/components/Workspace.tsx` | Updated workspace routing. |
| `frontend/src/main.tsx` | Added ProtectedRoute and customer portal routes. |
| `frontend/src/admin/pages/CustomerTiers.jsx` | Added rep assignment dropdown and new customer creation. |
| `frontend/src/components/ProtectedRoute.tsx` | **NEW** — Role-based route protection component. |

### Admin Portal (`admin-portal/`)
| File | Change |
|------|--------|
| `admin-portal/src/pages/CustomerTiers.jsx` | Added rep assignment UI for customer management. |

---

## New Directories

### `server/` — Customer Portal Node.js Backend
Express.js API server for the customer-facing portal:
- `server/index.js` — Main entry point (port 3001)
- `server/routes/auth.js` — Customer login/register with JWT + `assigned_rep_id`
- `server/routes/cart.js` — Cart management & quotation submission
- `server/routes/account.js` — Customer account info
- `server/routes/products.js` — Product catalog
- `server/db/` — SQLite database setup & seed data

### `frontend/src/customer/` — Customer Portal React Frontend
Full customer-facing portal integrated inside the Vite app:
- `customer/pages/Shop.jsx` — Product catalog with Add to Cart
- `customer/pages/Cart.jsx` — Cart with discount request form
- `customer/pages/Quotations.jsx` — Customer quotation list
- `customer/pages/QuotationDetail.jsx` — Quotation detail with workflow tracker
- `customer/pages/Account.jsx` — Customer account & orders
- `customer/pages/Login.jsx` — Customer login/register
- `customer/context/` — Auth & cart context providers
- `customer/components/` — Shared UI components (Nav, StatusTracker, etc.)
- `customer/api.js` — Customer portal API client

### `client/` — Static Customer Portal Assets
Static HTML/CSS landing and demo assets.

---

## Key Features Added

1. **Customer Portal** — Full B2B storefront (Shop → Cart → Quotation Request)
2. **Customer-to-Rep Assignment** — Every customer permanently linked to one Sales Rep
3. **Quotation Routing** — Customer portal requests land in the assigned rep's pipeline
4. **Discount Risk Scoring** — 4-signal engine (S, A, L, Z) with AUTO/MANAGER/FINANCE routing
5. **Manager Reassignment** — Managers can reassign unowned quotes to reps
6. **Audit Trail** — `quote_reassignments` table logs all reassignment events
7. **Role-Based Auth** — Separate login flows for Customer vs Sales Rep vs Manager
8. **Workflow Timeline** — Live status tracker matching the scoring engine's routing logic

---

## Port Map
| Service | Port | Description |
|---------|------|-------------|
| Customer Portal API | 3001 | Node.js/Express |
| Sales Rep Frontend | 5173 | Vite/React |
| Python Scoring API | 8000 | FastAPI |
| Admin Portal | 3000 | Vite/React |
| Clinch Core | 5000 | Node.js |
