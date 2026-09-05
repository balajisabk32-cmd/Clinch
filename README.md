# DealFlow360 (Clinch) — Unified Intelligent Sales Operations Platform

An intelligent, self-governing B2B deal execution and governance platform that transforms discount approvals from an offline bottleneck into an automated, explainable decision engine.

---

## 🏛 Platform Architecture & Directory Structure

All components are centralized within this `dealflow360` repository:

```text
dealflow360/
├── admin-portal/         # React 18 + Vite Admin & RevOps Portal (Port 3000)
│   ├── src/pages/            # 8 Modules: Dashboard, Products, Discounts, Warehouses, Subscriptions, Tiers, Anomalies, Reporting
│   ├── src/context/          # ClinchStoreContext state engine & ThemeContext
│   └── css/variables.css     # Porcelain Light Theme system
│
├── frontend/             # React 18 + Vite + Tailwind CSS SPA (Port 5173)
│   ├── src/pages/Login.tsx   # Unified Persona Login (Customer, Manager, Rep, Admin)
│   ├── src/components/       # Nav, Workspace, Policy Simulator, CPQ Cockpit
│   └── public/               # Brand assets & Flow Blueprint
│
├── backend/              # Python FastAPI Intelligence & Scoring Engine (Port 8000)
│   ├── engine/               # Pure mathematical risk scorer (S, A, L, Z signals)
│   ├── api/                  # FastAPI routes, fixtures, and policy simulation
│   └── tests/                # 43 automated pytest unit & integration tests
│
├── clinch/               # Node.js + Express + Prisma CPQ & Reporting Suite (Ports 5000 & 4000)
│   ├── src/                  # Core Express API, RBAC, CPQ state machine (Port 5000)
│   ├── server.js             # Deal Health & Reporting Dashboard server (Port 4000)
│   ├── test-client/          # Interactive Test Bench UI (Port 5000)
│   ├── public/               # Reporting & Risk Analytics UI (Port 4000)
│   ├── prisma/               # Schema, migrations & seed scripts
│   └── docs/                 # Clinch-specific API contracts & demo scripts
│
├── showcase/             # Standalone Interactive Landing & Video Hero (Port 8085)
│   ├── index.html            # Motion-enabled landing page with hero video & tabs
│   ├── styles.css            # Porcelain Light Theme design system
│   └── app.js                # Interactive simulation controls & deep-links
│
├── docs/                 # Architectural Blueprints & Governance Papers
│   ├── DealFlow360 - End to End Product Flow 24 hours oxp.png
│   ├── DealFlow360.pdf
│   ├── clinch-comparison-matrix.md
│   └── The Clinch Architecture_ Strategic Strengths and Operational Risks.txt
│
├── ARCHITECTURE.md       # Full mathematical & system architecture specification
├── CLINCH.md             # Grand-Prize Battle Plan & Failure Point Audits
├── CONTRACTS.md          # Formal API schemas & DTO contracts
└── start.ps1             # FastAPI backend startup script
```

---

## 🌐 Local Port & Service Matrix

| Service | Port | Technology | Primary Purpose |
|---|---|---|---|
| **Showcase & Video Landing** | `http://localhost:8085` | HTML5 / Vanilla CSS / JS | High-impact interactive landing, 3-second animated video loop, interactive CPQ preview |
| **DealFlow360 Workspace** | `http://localhost:5173` | React / Vite / TypeScript | Full application workspace & role-based cockpit with **Customer, Manager, Rep, Admin** login |
| **RevOps Admin Portal** | `http://localhost:3000` | React / Vite / Porcelain Theme | 8 RevOps modules: product catalog, discount rules, warehouse split, recurring subs, customer tiers, anomalies, & reporting |
| **Intelligence Engine** | `http://localhost:8000` | FastAPI / Python 3.13 | Real-time blended risk scoring (`S, A, L, Z`), policy blast radius simulation, SSE feeds |
| **Clinch Core & Test Bench** | `http://localhost:5000` | Node.js / Express / Prisma | CPQ catalog, pricing tiers (`BRONZE`, `SILVER`, `GOLD`), multi-role test bench |
| **Deal Health Suite** | `http://localhost:4000` | Node.js / Express / Vanilla UI | Stalled deals monitoring, margin leakage tracking, sales rep discount anomaly analytics |

---

## 👥 Unified Persona Workflow

The platform provides dedicated, role-tailored views in the exact sequence:

1. **Customer** (`customer@acmecorp.com` / Magic Link)
   - Tier: `GOLD` (Acme Corp).
   - Read-only deal room, transparent tier discounts, line-item negotiation requests without internal margin exposure.
2. **Manager** (`manager@dealflow360.com` / `Password123!`)
   - Role: `MANAGER`.
   - Pipeline review, high-risk approval queue, policy blast radius evaluation before sign-off.
3. **Rep** (`rep@dealflow360.com` / `Password123!`)
   - Role: `REP` (Alice Sales).
   - CPQ quotation builder, real-time discount guidance, instant AI margin-saver recommendations.
4. **Admin** (`admin@dealflow360.com` / `Password123!`)
   - Role: `ADMIN`.
   - Global governance, product catalog configuration, tier discount ceilings, and full audit logs.

---

## 🚀 Running the Services Locally

### 1. Intelligence Engine (Python / FastAPI — Port 8000)
```powershell
cd backend
python -m venv ..\.venv
..\.venv\Scripts\pip install -r requirements.txt
..\.venv\Scripts\uvicorn api.main:app --reload --port 8000
```
*API Docs: `http://localhost:8000/docs`*

### 2. DealFlow360 React Workspace (Port 5173)
```powershell
cd frontend
npm install
npm run dev
```
*App: `http://localhost:5173` (Login: `http://localhost:5173/login`)*

### 3. Clinch Core API & Test Bench (Node.js — Port 5000)
```powershell
cd clinch
npm install
npm start
```
*Test Bench: `http://localhost:5000`*

### 4. Deal Health & Reporting Suite (Node.js — Port 4000)
```powershell
cd clinch
npm run start:reporting
```
*Dashboard: `http://localhost:4000`*

### 5. Showcase Landing Page (Port 8085)
```powershell
# From the dealflow360/showcase or repository root:
python -m http.server 8085
```
*Landing: `http://localhost:8085`*

### 6. Revenue Operations Admin Portal (Port 3000)
```powershell
cd admin-portal
npm install
npm run dev
```
*Admin Portal: `http://localhost:3000`*

---

## 🧪 Testing & Validation

- **Backend Pytest**:
  ```powershell
  cd backend
  ..\.venv\Scripts\pytest
  # Result: 43 passed in ~1.09s
  ```
- **Frontend Typecheck & Build**:
  ```powershell
  cd frontend
  npx oxlint
  npm run build
  # Result: 0 errors, 0 warnings
  ```
- **Node Backend Syntax**:
  ```powershell
  cd clinch
  node -c server.js
  node -c src/server.js
  # Result: Syntax valid
  ```
