# Clinch | B2B Sales & Revenue Operations Admin Portal

A modern, high-performance B2B DealFlow360 revenue orchestration admin portal built with **React** and **Vite**. Clinch empowers RevOps teams to configure pricing rules, manage multi-tier approval chains, coordinate multi-location warehouse fulfillment, track recurring subscriptions, and monitor discount anomalies.

---

## 🚀 Key Modules & Features

1. **Revenue Cockpit (Dashboard)**
   - Real-time executive visibility across B2B deal velocity, turnaround trends, and category revenue splits.
   - Interactive SVG bar and line charts without external charting bloat.
   - Live activity feeds and quick-jump navigation cards.

2. **Products & Price Lists**
   - Multi-tier product catalog supporting SaaS software, hardware, and professional services.
   - Configurable product attributes, variants, and surcharge pricing.
   - Customer-tier price multipliers (Bronze, Silver, Gold) and multi-currency exchange settings.

3. **Discount Approvals & Governance**
   - **Customer Tier Discount Ceilings**: Global boundary caps per customer tier.
   - **Product-Specific Discount Limits**: Granular percentage limits per SKU with automated `MIN(Tier Ceiling, Product Limit)` cap logic.
   - **Multi-Level Approval Chain Builder**: Visual escalation workflows with SLAs and required approvers.
   - Full audit trail logging for all threshold and quote changes.

4. **Warehouses & Fulfillment**
   - Multi-hub management (Name, Location, Code, Contact Person, Active Status).
   - Per-hub stock inventory tracking with low-stock indicators (`Quantity <= Threshold`).
   - Replenishment rules with automated purchase order lead-time buffers.
   - Multi-warehouse auto-split fulfillment simulator with shipping weight factors.

5. **Recurring Subscriptions**
   - Product recurring billing plans (Monthly, Quarterly, Yearly).
   - Customer active contracts with automated proration and cancellation calculations.
   - Contracted MRR run-rate tracking.

6. **Customer Tier Upgrades**
   - Automated account tier promotion based on lifetime spend and deal volume.
   - Per-customer manual override locks and transition audit history.

7. **Discount Anomalies**
   - Statistical outlier detection with Z-score deviation sensitivity.
   - Hard margin floor hard stops and exception review workflows.

8. **Reporting & Analytics**
   - Multi-dimensional transaction filtering by period, team, category, and approval status.
   - PDF export and CSV spreadsheet downloads.

---

## 🛠️ Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Modular Vanilla CSS3 (Custom Design System, Glassmorphism, Dark/Light mode)
- **Icons**: Lucide React
- **State & Persistence**: React Context + Browser `localStorage`

---

## 💻 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/balajisabk32-cmd/Clinch.git

# Navigate into project directory
cd Clinch

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build
```bash
npm run build
```
The optimized production bundle will be output to the `dist/` directory.

---

## 📄 License
ISC License
