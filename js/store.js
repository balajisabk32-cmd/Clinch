// Global Data Store & Persistence Engine for Clinch Admin Portal
(function () {
  const STORE_KEY = 'clinch_master_store_v1';

  const defaultState = {
    products: [
      {
        id: 'PRD-101',
        name: 'Enterprise Cloud Suite License',
        sku: 'ECS-ENTERPRISE-ANNUAL',
        category: 'SaaS Software',
        basePrice: 1200,
        unit: 'per user / yr',
        taxRate: 18,
        status: 'Active',
        description: 'Core B2B enterprise revenue orchestration platform with unlimited team seats.',
        variants: [
          { attribute: 'Tier', values: 'Gold Support', extraPrice: 200 },
          { attribute: 'Storage', values: '1 TB High-Speed', extraPrice: 150 }
        ]
      },
      {
        id: 'PRD-102',
        name: 'Apex Edge Gateway Router X9',
        sku: 'HW-APEX-X9',
        category: 'Hardware',
        basePrice: 3450,
        unit: 'per unit',
        taxRate: 12,
        status: 'Active',
        description: 'Dual-redundant high throughput hardware gateway for multi-site enterprise interconnect.',
        variants: [
          { attribute: 'Power Supply', values: 'Redundant AC/DC', extraPrice: 350 },
          { attribute: 'Ports', values: '24 x 10GbE SFP+', extraPrice: 600 }
        ]
      },
      {
        id: 'PRD-103',
        name: 'Custom ERP Data Migration & Onboarding',
        sku: 'SVC-MIG-ERP-01',
        category: 'Professional Services',
        basePrice: 8500,
        unit: 'per engagement',
        taxRate: 18,
        status: 'Active',
        description: 'End-to-end integration and data pipeline deployment by certified solution architects.',
        variants: [
          { attribute: 'Timeline', values: 'Fast-Track (2 weeks)', extraPrice: 2500 }
        ]
      },
      {
        id: 'PRD-104',
        name: 'Secure Cloud Edge Node Appliance',
        sku: 'HW-NODE-EDGE-2',
        category: 'Hardware',
        basePrice: 2150,
        unit: 'per unit',
        taxRate: 12,
        status: 'Active',
        description: 'Zero-trust edge computing hardware with hardware security module (HSM).',
        variants: []
      },
      {
        id: 'PRD-105',
        name: 'AI Deal Predictor & RevOps Analytics Add-on',
        sku: 'SFT-AI-COPILOT',
        category: 'SaaS Software',
        basePrice: 480,
        unit: 'per user / yr',
        taxRate: 18,
        status: 'Active',
        description: 'Predictive win-probability and automated discount coaching model engine.',
        variants: [
          { attribute: 'LLM Model', values: 'Dedicated Private Tenant', extraPrice: 350 }
        ]
      },
      {
        id: 'PRD-106',
        name: '24/7 Mission-Critical Technical Support TAM',
        sku: 'SVC-TAM-24X7',
        category: 'Professional Services',
        basePrice: 4200,
        unit: 'per quarter',
        taxRate: 18,
        status: 'Active',
        description: 'Dedicated Technical Account Manager with 15-minute guaranteed SLA.',
        variants: []
      },
      {
        id: 'PRD-107',
        name: '24/7 Monitoring Service',
        sku: 'SVC-MONITOR-24X7',
        category: 'Professional Services',
        basePrice: 2000,
        unit: 'per month',
        taxRate: 18,
        status: 'Active',
        description: 'Continuous 24/7 uptime, synthetic heartbeat, and latency telemetry monitoring with automated alerting.',
        variants: []
      },
      {
        id: 'PRD-108',
        name: 'Annual Maintenance Plan',
        sku: 'SVC-MAINT-ANNUAL',
        category: 'Professional Services',
        basePrice: 12000,
        unit: 'per year',
        taxRate: 18,
        status: 'Active',
        description: 'Comprehensive annual preventative maintenance, on-site diagnostics, and system firmware upgrades.',
        variants: []
      },
      {
        id: 'PRD-109',
        name: 'Premium Support',
        sku: 'SVC-PREMIUM-SUPP',
        category: 'SaaS Software',
        basePrice: 5000,
        unit: 'per month',
        taxRate: 18,
        status: 'Active',
        description: 'Priority 24/7 SLA, designated solutions engineering team, and unlimited incident tickets.',
        variants: []
      }
    ],

    priceLists: {
      tiers: {
        Bronze: { multiplier: 1.0, discountLabel: 'Standard List Price' },
        Silver: { multiplier: 0.92, discountLabel: '8% Tier Discount' },
        Gold: { multiplier: 0.85, discountLabel: '15% Tier Discount' }
      },
      currencies: [
        { code: 'USD', symbol: '$', rate: 1.00, isBase: true },
        { code: 'INR', symbol: '₹', rate: 86.50, isBase: false },
        { code: 'EUR', symbol: '€', rate: 0.92, isBase: false },
        { code: 'GBP', symbol: '£', rate: 0.79, isBase: false }
      ]
    },

    discountApproval: {
      tierCeilings: {
        Bronze: 10,
        Silver: 20,
        Gold: 30
      },
      productDiscountRules: {
        'PRD-101': { Bronze: 5, Silver: 10, Gold: 20 },
        'PRD-102': { Bronze: 5, Silver: 10, Gold: 15 },
        'PRD-103': { Bronze: 4, Silver: 8, Gold: 15 },
        'PRD-104': { Bronze: 4, Silver: 8, Gold: 12 },
        'PRD-105': { Bronze: 5, Silver: 12, Gold: 22 },
        'PRD-106': { Bronze: 3, Silver: 7, Gold: 14 },
        'PRD-107': { Bronze: 5, Silver: 10, Gold: 15 },
        'PRD-108': { Bronze: 5, Silver: 10, Gold: 15 },
        'PRD-109': { Bronze: 5, Silver: 10, Gold: 15 }
      },
      approvalChain: [
        { id: 1, minDiscount: 0, maxDiscount: 10, label: 'Sales Rep Discretion (Auto-Approved)', approvers: ['Sales Rep (Self)'], timeSLA: 'Instant Auto-Approve' },
        { id: 2, minDiscount: 10.1, maxDiscount: 20, label: 'Sales Manager Approval', approvers: ['Sales Manager'], timeSLA: '< 4 Hours' },
        { id: 3, minDiscount: 20.1, maxDiscount: 30, label: 'Sales Manager + Finance Approval', approvers: ['Sales Manager', 'Finance Director'], timeSLA: '< 12 Hours' },
        { id: 4, minDiscount: 30.1, maxDiscount: 50, label: 'Executive / VP Revenue Approval', approvers: ['VP of Revenue', 'CFO'], timeSLA: '< 24 Hours' }
      ],
      productRuleAuditLogs: [
        { id: 'PR-AUD-101', productName: 'Apex Edge Gateway Router X9', sku: 'HW-APEX-X9', oldDiscount: 'Bronze: 6% | Silver: 12% | Gold: 18%', newDiscount: 'Bronze: 5% | Silver: 10% | Gold: 15%', changedBy: 'Alex Vance (VP RevOps)', timestamp: '2026-09-04 14:30' },
        { id: 'PR-AUD-100', productName: 'Enterprise Cloud Suite License', sku: 'ECS-ENTERPRISE-ANNUAL', oldDiscount: 'Bronze: 5% | Silver: 10% | Gold: 25%', newDiscount: 'Bronze: 5% | Silver: 10% | Gold: 20%', changedBy: 'Alex Vance (VP RevOps)', timestamp: '2026-09-02 11:15' }
      ],
      auditLogs: [
        { id: 'AUD-891', deal: 'Global Logistics Corp (Cloud Modernization)', rep: 'Marcus Sterling', discount: '24.5%', approver: 'Sarah Jenkins (Finance)', status: 'Approved', timestamp: '2026-09-04 16:20', reason: 'Multi-year commitment upfront with 3-year term' },
        { id: 'AUD-890', deal: 'Fintech Solutions (Gateway X9 Rollout)', rep: 'Priya Patel', discount: '34.0%', approver: 'VP Alex Vance', status: 'Approved', timestamp: '2026-09-03 11:45', reason: 'Competitive defense against legacy vendor' },
        { id: 'AUD-889', deal: 'Apex Healthcare (TAM Support)', rep: 'Liam O\'Connor', discount: '28.0%', approver: 'Sarah Jenkins (Finance)', status: 'Rejected', timestamp: '2026-09-02 14:10', reason: 'Service margin eroded below corporate floor (min 20%)' },
        { id: 'AUD-888', deal: 'Titan Retail Group (Annual ERP)', rep: 'Marcus Sterling', discount: '18.0%', approver: 'David Chen (Sales Mgr)', status: 'Approved', timestamp: '2026-09-01 09:30', reason: 'Quarter-end volume accelerator quota' }
      ]
    },

    warehouses: [
      { id: 'WH-US-01', code: 'US-EAST', name: 'Ashburn Logistics Hub', location: '44800 Beaumeade Cir, Ashburn, VA 20147', contactPerson: 'Derek Reynolds', status: 'Active', capacity: 45000, utilized: 34200 },
      { id: 'WH-US-02', code: 'US-WEST', name: 'Silicon Valley Fulfillment', location: '1250 S 10th St, San Jose, CA 95112', contactPerson: 'Elena Gomez', status: 'Active', capacity: 35000, utilized: 26800 },
      { id: 'WH-EU-01', code: 'EU-CENTRAL', name: 'Frankfurt Central Depot', location: 'Speicherstrasse 55, 60327 Frankfurt, Germany', contactPerson: 'Hans Mueller', status: 'Active', capacity: 50000, utilized: 41500 },
      { id: 'WH-IN-01', code: 'IN-SOUTH', name: 'Bengaluru Tech Logistics Hub', location: 'Electronic City Phase 1, Hosur Rd, Bengaluru 560100', contactPerson: 'Rajesh Sharma', status: 'Active', capacity: 40000, utilized: 28400 },
      { id: 'WH-AP-01', code: 'APAC-SG', name: 'Jurong Port Warehouse', location: '37 Jurong Port Rd, Singapore 619110', contactPerson: 'Mei Ling Tan', status: 'Active', capacity: 30000, utilized: 19800 }
    ],

    warehouseStock: {
      'WH-US-01': [
        { productId: 'PRD-102', productName: 'Apex Edge Gateway Router X9', sku: 'HW-APEX-X9', quantity: 240, reorderThreshold: 50, lastRestocked: '2026-08-28' },
        { productId: 'PRD-104', productName: 'Secure Cloud Edge Node Appliance', sku: 'HW-NODE-EDGE-2', quantity: 18, reorderThreshold: 30, lastRestocked: '2026-08-15' },
        { productId: 'PRD-101', productName: 'Enterprise Cloud Suite License', sku: 'ECS-ENTERPRISE-ANNUAL', quantity: 1500, reorderThreshold: 200, lastRestocked: '2026-09-01' },
        { productId: 'PRD-105', productName: 'AI Deal Predictor & RevOps Analytics Add-on', sku: 'SFT-AI-COPILOT', quantity: 780, reorderThreshold: 100, lastRestocked: '2026-08-20' }
      ],
      'WH-US-02': [
        { productId: 'PRD-102', productName: 'Apex Edge Gateway Router X9', sku: 'HW-APEX-X9', quantity: 85, reorderThreshold: 40, lastRestocked: '2026-08-20' },
        { productId: 'PRD-104', productName: 'Secure Cloud Edge Node Appliance', sku: 'HW-NODE-EDGE-2', quantity: 110, reorderThreshold: 25, lastRestocked: '2026-08-30' },
        { productId: 'PRD-105', productName: 'AI Deal Predictor & RevOps Analytics Add-on', sku: 'SFT-AI-COPILOT', quantity: 14, reorderThreshold: 25, lastRestocked: '2026-08-10' }
      ],
      'WH-EU-01': [
        { productId: 'PRD-102', productName: 'Apex Edge Gateway Router X9', sku: 'HW-APEX-X9', quantity: 12, reorderThreshold: 35, lastRestocked: '2026-08-05' },
        { productId: 'PRD-104', productName: 'Secure Cloud Edge Node Appliance', sku: 'HW-NODE-EDGE-2', quantity: 65, reorderThreshold: 20, lastRestocked: '2026-08-25' },
        { productId: 'PRD-103', productName: 'Custom ERP Data Migration & Onboarding', sku: 'SVC-MIG-ERP-01', quantity: 45, reorderThreshold: 10, lastRestocked: '2026-08-18' }
      ],
      'WH-IN-01': [
        { productId: 'PRD-102', productName: 'Apex Edge Gateway Router X9', sku: 'HW-APEX-X9', quantity: 160, reorderThreshold: 50, lastRestocked: '2026-08-29' },
        { productId: 'PRD-104', productName: 'Secure Cloud Edge Node Appliance', sku: 'HW-NODE-EDGE-2', quantity: 95, reorderThreshold: 30, lastRestocked: '2026-08-22' },
        { productId: 'PRD-106', productName: '24/7 Mission-Critical Technical Support TAM', sku: 'SVC-TAM-24X7', quantity: 6, reorderThreshold: 15, lastRestocked: '2026-08-12' }
      ],
      'WH-AP-01': [
        { productId: 'PRD-102', productName: 'Apex Edge Gateway Router X9', sku: 'HW-APEX-X9', quantity: 45, reorderThreshold: 25, lastRestocked: '2026-08-26' },
        { productId: 'PRD-104', productName: 'Secure Cloud Edge Node Appliance', sku: 'HW-NODE-EDGE-2', quantity: 8, reorderThreshold: 20, lastRestocked: '2026-08-18' }
      ]
    },

    replenishmentRules: {
      minSafetyStock: 150,
      reorderQuantity: 600,
      leadTimeDays: 14,
      autoTriggerPO: true,
      autoFlagBelowThreshold: true,
      preferredSupplier: 'Apex Global Microtech Ltd'
    },

    shippingWeighting: {
      weightFactor: 2.4,       // $/kg
      distanceFactor: 0.12,    // $/mile
      urgencyMultiplier: 1.6,  // Express multiplier
      handlingSurcharge: 25.0  // base handling
    },

    subscriptions: {
      recurringPlans: [
        {
          id: 'REC-PLAN-01',
          productId: 'PRD-107',
          billingCycle: 'Monthly',
          recurringPrice: 2000,
          status: 'Active',
          description: 'Continuous 24/7 uptime, synthetic heartbeat, and latency telemetry monitoring with automated incident alerting.'
        },
        {
          id: 'REC-PLAN-02',
          productId: 'PRD-108',
          billingCycle: 'Yearly',
          recurringPrice: 12000,
          status: 'Active',
          description: 'Comprehensive annual preventative maintenance, on-site hardware inspections, and firmware security patch updates.'
        },
        {
          id: 'REC-PLAN-03',
          productId: 'PRD-109',
          billingCycle: 'Monthly',
          recurringPrice: 5000,
          status: 'Active',
          description: 'Enterprise priority support with 15-minute response SLA and dedicated solutions architect assistance.'
        },
        {
          id: 'REC-PLAN-04',
          productId: 'PRD-106',
          billingCycle: 'Quarterly',
          recurringPrice: 4200,
          status: 'Active',
          description: 'Dedicated Technical Account Manager with 15-minute guaranteed SLA for critical operations.'
        },
        {
          id: 'REC-PLAN-05',
          productId: 'PRD-101',
          billingCycle: 'Yearly',
          recurringPrice: 1200,
          status: 'Active',
          description: 'Annual enterprise revenue orchestration platform license per seat with unlimited pipeline analytics.'
        }
      ]
    },

    customerSubscriptions: [
      {
        id: 'SUB-CUST-801',
        customerName: 'Acme Corp',
        customerTier: 'Gold',
        planId: 'REC-PLAN-01',
        productId: 'PRD-107',
        productName: '24/7 Monitoring Service',
        recurringPrice: 2000,
        discountPct: 15,
        finalPrice: 1700,
        billingCycle: 'Monthly',
        startDate: '2026-09-05',
        nextBillingDate: '2026-10-05',
        status: 'Active',
        autoRenew: true,
        lastInvoiceNumber: 'INV-2026-9081'
      },
      {
        id: 'SUB-CUST-802',
        customerName: 'Vertex BioPharma Inc',
        customerTier: 'Gold',
        planId: 'REC-PLAN-02',
        productId: 'PRD-108',
        productName: 'Annual Maintenance Plan',
        recurringPrice: 12000,
        discountPct: 15,
        finalPrice: 10200,
        billingCycle: 'Yearly',
        startDate: '2026-08-15',
        nextBillingDate: '2027-08-15',
        status: 'Active',
        autoRenew: true,
        lastInvoiceNumber: 'INV-2026-8742'
      },
      {
        id: 'SUB-CUST-803',
        customerName: 'Pacific Retail Systems',
        customerTier: 'Silver',
        planId: 'REC-PLAN-03',
        productId: 'PRD-109',
        productName: 'Premium Support',
        recurringPrice: 5000,
        discountPct: 8,
        finalPrice: 4600,
        billingCycle: 'Monthly',
        startDate: '2026-07-20',
        nextBillingDate: '2026-10-20',
        status: 'Active',
        autoRenew: true,
        lastInvoiceNumber: 'INV-2026-7912'
      }
    ],


    customerTiers: {
      thresholds: {
        Bronze: { minSpend: 0, minDeals: 0 },
        Silver: { minSpend: 25000, minDeals: 3 },
        Gold: { minSpend: 100000, minDeals: 8 }
      },
      customers: [
        { id: 'CUST-01', name: 'Vertex BioPharma Inc', spend: 384000, deals: 18, currentTier: 'Gold', mode: 'Auto', lastEvaluated: '2026-09-04' },
        { id: 'CUST-02', name: 'Meridian Financial Corp', spend: 142000, deals: 11, currentTier: 'Gold', mode: 'Auto', lastEvaluated: '2026-09-02' },
        { id: 'CUST-03', name: 'AeroDynamics Global', spend: 89000, deals: 6, currentTier: 'Gold', mode: 'Manual', lastEvaluated: '2026-08-28' },
        { id: 'CUST-04', name: 'Pacific Retail Systems', spend: 34500, deals: 4, currentTier: 'Silver', mode: 'Auto', lastEvaluated: '2026-09-01' },
        { id: 'CUST-05', name: 'CyberShield Logistics', spend: 14800, deals: 2, currentTier: 'Bronze', mode: 'Auto', lastEvaluated: '2026-09-03' }
      ],
      auditTrail: [
        { id: 'TR-108', customer: 'Vertex BioPharma Inc', oldTier: 'Silver', newTier: 'Gold', date: '2026-09-04', reason: 'Total order spend exceeded $100k ($384k lifetime)', type: 'Auto', admin: 'Clinch Auto-Rule Engine' },
        { id: 'TR-107', customer: 'AeroDynamics Global', oldTier: 'Silver', newTier: 'Gold', date: '2026-08-28', reason: 'Executive strategic account override', type: 'Manual', admin: 'Alex Vance (VP RevOps)' },
        { id: 'TR-106', customer: 'Meridian Financial Corp', oldTier: 'Bronze', newTier: 'Silver', date: '2026-08-15', reason: 'Order volume passed $25k threshold', type: 'Auto', admin: 'Clinch Auto-Rule Engine' }
      ]
    },


    anomalies: {
      settings: {
        sensitivityPct: 12, // flag if 12% above rep's 90-day moving average
        marginFloorErosionPct: 18,
        quarterEndGraceAllowed: false
      },
      flagged: [
        {
          id: 'ANOM-441',
          rep: 'Marcus Sterling',
          account: 'Starlight Media Global',
          proposedDiscount: 29.5,
          repAverage: 14.2,
          anomalyScore: 92,
          risk: 'Critical',
          status: 'Pending Review',
          flaggedAt: 'Today, 09:15 AM'
        },
        {
          id: 'ANOM-440',
          rep: 'Liam O\'Connor',
          account: 'Nordic Horizon Transport',
          proposedDiscount: 24.0,
          repAverage: 11.5,
          anomalyScore: 81,
          risk: 'High',
          status: 'Pending Review',
          flaggedAt: 'Yesterday, 17:40 PM'
        },
        {
          id: 'ANOM-439',
          rep: 'Priya Patel',
          account: 'Delta BioTech Labs',
          proposedDiscount: 19.5,
          repAverage: 10.8,
          anomalyScore: 68,
          risk: 'Medium',
          status: 'Pending Review',
          flaggedAt: '2 days ago'
        }
      ]
    },

    analytics: {
      kpis: {
        totalRevenue: '$4,892,400',
        revenueDelta: '+14.2%',
        activeDeals: '184',
        dealsPipeline: '$18.6M',
        pendingApprovals: '12',
        approvalsDelta: '-3 vs yesterday',
        avgDiscount: '11.4%',
        discountDelta: '-1.8% optimized'
      },
      categoryRevenue: [
        { label: 'SaaS Software', value: 2450000 },
        { label: 'Hardware', value: 1320000 },
        { label: 'Prof. Services', value: 810000 },
        { label: 'Support & TAM', value: 312400 }
      ],
      turnaroundTrend: [
        { label: 'Mon', value: 5.6 },
        { label: 'Tue', value: 4.8 },
        { label: 'Wed', value: 4.1 },
        { label: 'Thu', value: 3.4 },
        { label: 'Fri', value: 2.9 },
        { label: 'Sat', value: 2.2 },
        { label: 'Sun', value: 2.5 }
      ],
      recentActivity: [
        { id: 'ACT-1', title: 'Sarah Jenkins approved 24.5% discount for Global Logistics Corp', time: '12 mins ago', type: 'approval', color: '#10b981' },
        { id: 'ACT-2', title: 'Marcus Sterling created Quote #QT-9921 for Starlight Media ($210,000)', time: '45 mins ago', type: 'quote', color: '#0ea5e9' },
        { id: 'ACT-3', title: 'Customer Vertex BioPharma auto-promoted to Platinum Tier', time: '2 hours ago', type: 'tier', color: '#06b6d4' },
        { id: 'ACT-4', title: 'Anomaly Detector flagged Marcus Sterling discount request (92% anomaly score)', time: '3 hours ago', type: 'anomaly', color: '#ef4444' }
      ]
    }
  };

  class ClinchStore {
    constructor() {
      this.state = this.loadState();
    }

    loadState() {
      try {
        const stored = localStorage.getItem(STORE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Migration: ensure warehouseStock exists
          if (!parsed.warehouseStock) {
            parsed.warehouseStock = JSON.parse(JSON.stringify(defaultState.warehouseStock));
          }
          if (parsed.warehouses) {
            parsed.warehouses.forEach((w, i) => {
              if (!w.contactPerson) {
                w.contactPerson = defaultState.warehouses[i]?.contactPerson || w.manager || 'Logistics Lead';
              }
              if (!w.status || w.status === 'Operational') {
                w.status = 'Active';
              }
            });
          }
          if (parsed.replenishmentRules && parsed.replenishmentRules.autoFlagBelowThreshold === undefined) {
            parsed.replenishmentRules.autoFlagBelowThreshold = true;
          }
          if (parsed.discountApproval) {
            // Remove Platinum and categoryCeilings
            if (parsed.discountApproval.tierCeilings) {
              delete parsed.discountApproval.tierCeilings.Platinum;
              if (parsed.discountApproval.tierCeilings.Bronze === undefined) parsed.discountApproval.tierCeilings.Bronze = 10;
              if (parsed.discountApproval.tierCeilings.Silver === undefined) parsed.discountApproval.tierCeilings.Silver = 20;
              if (parsed.discountApproval.tierCeilings.Gold === undefined) parsed.discountApproval.tierCeilings.Gold = 30;
            }
            if (parsed.discountApproval.categoryCeilings) {
              delete parsed.discountApproval.categoryCeilings;
            }
            if (!parsed.discountApproval.productDiscountRules) {
              parsed.discountApproval.productDiscountRules = JSON.parse(JSON.stringify(defaultState.discountApproval.productDiscountRules));
            }
            ['PRD-107', 'PRD-108', 'PRD-109'].forEach(pid => {
              if (!parsed.discountApproval.productDiscountRules[pid]) {
                parsed.discountApproval.productDiscountRules[pid] = { Bronze: 5, Silver: 10, Gold: 15 };
              }
            });
            if (!parsed.discountApproval.productRuleAuditLogs) {
              parsed.discountApproval.productRuleAuditLogs = JSON.parse(JSON.stringify(defaultState.discountApproval.productRuleAuditLogs));
            }
          }

          // Ensure recurring products exist in products array
          if (parsed.products) {
            defaultState.products.forEach(dp => {
              if (!parsed.products.some(p => p.id === dp.id)) {
                parsed.products.push(JSON.parse(JSON.stringify(dp)));
              }
            });
          }

          // Migrate subscriptions from old SaaS tier plans to product recurring plans
          if (!parsed.subscriptions || !parsed.subscriptions.recurringPlans || (parsed.subscriptions.plans && parsed.subscriptions.plans.some(p => p.id === 'SUB-STARTER'))) {
            parsed.subscriptions = JSON.parse(JSON.stringify(defaultState.subscriptions));
          }

          // Ensure customerSubscriptions exist
          if (!parsed.customerSubscriptions || !Array.isArray(parsed.customerSubscriptions) || parsed.customerSubscriptions.length === 0) {
            parsed.customerSubscriptions = JSON.parse(JSON.stringify(defaultState.customerSubscriptions));
          }

          // Clean up removed modules
          if (parsed.upsell) delete parsed.upsell;
          if (parsed.dealCoach) delete parsed.dealCoach;

          return parsed;
        }
      } catch (e) {
        console.error('Error loading stored state, falling back to default', e);
      }
      return JSON.parse(JSON.stringify(defaultState));
    }

    saveState() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
        window.dispatchEvent(new CustomEvent('clinch-state-updated', { detail: this.state }));
      } catch (e) {
        console.error('Error saving state to localStorage', e);
      }
    }

    resetToDefault() {
      this.state = JSON.parse(JSON.stringify(defaultState));
      this.saveState();
      return this.state;
    }

    // Products CRUD
    getProducts() {
      return this.state.products;
    }

    addProduct(product) {
      this.state.products.unshift(product);
      // Automatically assign default product discount rules
      if (!this.state.discountApproval.productDiscountRules) {
        this.state.discountApproval.productDiscountRules = {};
      }
      this.state.discountApproval.productDiscountRules[product.id] = {
        Bronze: 5,
        Silver: 10,
        Gold: 15
      };
      this.saveState();
      return product;
    }

    updateProduct(id, updated) {
      const idx = this.state.products.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.state.products[idx] = { ...this.state.products[idx], ...updated };
        this.saveState();
        return this.state.products[idx];
      }
      return null;
    }

    deleteProduct(id) {
      this.state.products = this.state.products.filter(p => p.id !== id);
      if (this.state.discountApproval?.productDiscountRules) {
        delete this.state.discountApproval.productDiscountRules[id];
      }
      this.saveState();
    }

    // Price Lists
    getPriceLists() {
      return this.state.priceLists;
    }

    savePriceLists(priceLists) {
      this.state.priceLists = priceLists;
      this.saveState();
    }

    // Discounts & Approvals
    getDiscountConfig() {
      return this.state.discountApproval;
    }

    saveDiscountConfig(cfg) {
      this.state.discountApproval = { ...this.state.discountApproval, ...cfg };
      this.saveState();
    }

    // Product Discount Rules
    getProductDiscountRules() {
      if (!this.state.discountApproval.productDiscountRules) {
        this.state.discountApproval.productDiscountRules = {};
      }
      return this.state.discountApproval.productDiscountRules;
    }

    getProductDiscountRule(productId) {
      const rules = this.getProductDiscountRules();
      if (!rules[productId]) {
        rules[productId] = { Bronze: 5, Silver: 10, Gold: 15 };
        this.saveState();
      }
      return rules[productId];
    }

    saveProductDiscountRule(productId, newRules, adminName = 'Alex Vance (VP RevOps)') {
      const product = this.getProducts().find(p => p.id === productId);
      const prodName = product ? product.name : productId;
      const sku = product ? product.sku : '';
      const oldRule = this.getProductDiscountRule(productId);
      const oldStr = `Bronze: ${oldRule.Bronze || 0}% | Silver: ${oldRule.Silver || 0}% | Gold: ${oldRule.Gold || 0}%`;
      const newStr = `Bronze: ${newRules.Bronze || 0}% | Silver: ${newRules.Silver || 0}% | Gold: ${newRules.Gold || 0}%`;

      this.state.discountApproval.productDiscountRules[productId] = {
        Bronze: parseFloat(newRules.Bronze) || 0,
        Silver: parseFloat(newRules.Silver) || 0,
        Gold: parseFloat(newRules.Gold) || 0
      };

      if (!this.state.discountApproval.productRuleAuditLogs) {
        this.state.discountApproval.productRuleAuditLogs = [];
      }

      this.state.discountApproval.productRuleAuditLogs.unshift({
        id: `PR-AUD-${Math.floor(100 + Math.random() * 900)}`,
        productName: prodName,
        sku: sku,
        oldDiscount: oldStr,
        newDiscount: newStr,
        changedBy: adminName,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
      });

      this.saveState();
      return this.state.discountApproval.productDiscountRules[productId];
    }

    getProductRuleAuditLogs() {
      return this.state.discountApproval.productRuleAuditLogs || [];
    }

    calculateEffectiveDiscount(productId, customerTier) {
      const tierMax = this.state.discountApproval.tierCeilings[customerTier] || 0;
      const prodRules = this.getProductDiscountRule(productId);
      const prodMax = prodRules[customerTier] !== undefined ? prodRules[customerTier] : tierMax;
      const effectiveMax = Math.min(tierMax, prodMax);
      return {
        customerTier,
        tierCeiling: tierMax,
        productMax: prodMax,
        effectiveMax,
        isCappedByTier: prodMax > tierMax
      };
    }

    processCustomerDiscountRequest({ customerName, customerTier, productId, requestedDiscount, message = '' }) {
      const product = this.getProducts().find(p => p.id === productId);
      if (!product) return { success: false, error: 'Product not found' };

      const basePrice = product.basePrice;
      const reqDisc = parseFloat(requestedDiscount) || 0;
      const { tierCeiling, productMax, effectiveMax } = this.calculateEffectiveDiscount(productId, customerTier);

      // Determine matching approval chain step
      const chain = this.state.discountApproval.approvalChain || [];
      const matchedStep = chain.find(step => reqDisc >= step.minDiscount && reqDisc <= step.maxDiscount) || chain[chain.length - 1];

      const isWithinEffective = reqDisc <= effectiveMax;
      const isAutoApproved = isWithinEffective && (matchedStep.approvers.includes('Sales Rep (Self)') || reqDisc <= 10);

      const finalStatus = isAutoApproved ? 'Approved' : 'Pending Review';
      const discountedPrice = Math.round(basePrice * (1 - reqDisc / 100));

      const logEntry = {
        id: `AUD-${Math.floor(100 + Math.random() * 900)}`,
        deal: `${customerName} (${product.name})`,
        rep: 'Online Customer Quotation',
        discount: `${reqDisc}%`,
        approver: isAutoApproved ? 'Auto-Approval Engine' : matchedStep.approvers.join(' + '),
        status: finalStatus,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        reason: isWithinEffective
          ? `Within effective ${customerTier} product maximum (${effectiveMax}%). ${message ? 'Note: ' + message : ''}`
          : `Requested ${reqDisc}% exceeds effective ${customerTier} product maximum (${effectiveMax}% capped by tier ${tierCeiling}% / prod ${productMax}%). Routed to ${matchedStep.label}. ${message ? 'Note: ' + message : ''}`
      };

      if (!this.state.discountApproval.auditLogs) {
        this.state.discountApproval.auditLogs = [];
      }
      this.state.discountApproval.auditLogs.unshift(logEntry);
      this.saveState();

      return {
        success: true,
        customerName,
        customerTier,
        product,
        basePrice,
        requestedDiscount: reqDisc,
        effectiveMax,
        discountedPrice,
        isWithinEffective,
        isAutoApproved,
        status: finalStatus,
        approvalStep: matchedStep,
        logEntry
      };
    }

    // Warehouses & Fulfillment
    getWarehouses() {
      return this.state.warehouses;
    }

    addWarehouse(wh) {
      this.state.warehouses.push(wh);
      if (!this.state.warehouseStock) this.state.warehouseStock = {};
      if (!this.state.warehouseStock[wh.id]) this.state.warehouseStock[wh.id] = [];
      this.saveState();
      return wh;
    }

    updateWarehouse(id, wh) {
      const idx = this.state.warehouses.findIndex(w => w.id === id);
      if (idx !== -1) {
        this.state.warehouses[idx] = { ...this.state.warehouses[idx], ...wh };
        this.saveState();
        return this.state.warehouses[idx];
      }
      return null;
    }

    deleteWarehouse(id) {
      this.state.warehouses = this.state.warehouses.filter(w => w.id !== id);
      if (this.state.warehouseStock && this.state.warehouseStock[id]) {
        delete this.state.warehouseStock[id];
      }
      this.saveState();
    }

    // Warehouse Stock Management per Warehouse
    getWarehouseStock(warehouseId) {
      if (!this.state.warehouseStock) this.state.warehouseStock = {};
      return this.state.warehouseStock[warehouseId] || [];
    }

    addWarehouseStock(warehouseId, stockEntry) {
      if (!this.state.warehouseStock) this.state.warehouseStock = {};
      if (!this.state.warehouseStock[warehouseId]) this.state.warehouseStock[warehouseId] = [];
      this.state.warehouseStock[warehouseId].push(stockEntry);
      this.saveState();
      return stockEntry;
    }

    updateWarehouseStock(warehouseId, productId, updatedFields) {
      if (!this.state.warehouseStock || !this.state.warehouseStock[warehouseId]) return null;
      const idx = this.state.warehouseStock[warehouseId].findIndex(s => s.productId === productId || s.sku === productId);
      if (idx !== -1) {
        this.state.warehouseStock[warehouseId][idx] = { ...this.state.warehouseStock[warehouseId][idx], ...updatedFields };
        this.saveState();
        return this.state.warehouseStock[warehouseId][idx];
      }
      return null;
    }

    removeWarehouseStock(warehouseId, productId) {
      if (!this.state.warehouseStock || !this.state.warehouseStock[warehouseId]) return;
      this.state.warehouseStock[warehouseId] = this.state.warehouseStock[warehouseId].filter(s => s.productId !== productId && s.sku !== productId);
      this.saveState();
    }

    getReplenishmentRules() {
      return this.state.replenishmentRules;
    }

    saveReplenishmentRules(rules) {
      this.state.replenishmentRules = { ...this.state.replenishmentRules, ...rules };
      this.saveState();
    }

    getShippingWeighting() {
      return this.state.shippingWeighting;
    }

    saveShippingWeighting(settings) {
      this.state.shippingWeighting = { ...this.state.shippingWeighting, ...settings };
      this.saveState();
    }

    // Subscriptions & Recurring Plans
    getSubscriptions() {
      return this.state.subscriptions;
    }

    saveSubscriptions(subs) {
      this.state.subscriptions = { ...this.state.subscriptions, ...subs };
      this.saveState();
    }

    getRecurringPlans() {
      if (!this.state.subscriptions || !this.state.subscriptions.recurringPlans) {
        this.state.subscriptions = JSON.parse(JSON.stringify(defaultState.subscriptions));
      }
      const products = this.getProducts();
      return this.state.subscriptions.recurringPlans.map(plan => {
        const prod = products.find(p => p.id === plan.productId) || {
          id: plan.productId,
          name: 'Custom Service',
          category: 'Professional Services',
          sku: 'SVC-REC',
          basePrice: plan.recurringPrice,
          unit: `per ${plan.billingCycle.toLowerCase()}`
        };
        const rules = this.getProductDiscountRule(plan.productId) || { Bronze: 5, Silver: 10, Gold: 15 };
        return {
          ...plan,
          product: prod,
          productName: prod.name,
          category: prod.category,
          sku: prod.sku,
          basePrice: prod.basePrice,
          discountRules: rules
        };
      });
    }

    getRecurringPlan(id) {
      return this.getRecurringPlans().find(p => p.id === id) || null;
    }

    saveRecurringPlan(planData) {
      if (!this.state.subscriptions || !this.state.subscriptions.recurringPlans) {
        this.state.subscriptions = { recurringPlans: [] };
      }
      const plans = this.state.subscriptions.recurringPlans;
      if (planData.id) {
        const idx = plans.findIndex(p => p.id === planData.id);
        if (idx !== -1) {
          plans[idx] = { ...plans[idx], ...planData };
          this.saveState();
          return plans[idx];
        }
      }
      const newPlan = {
        id: `REC-PLAN-${Math.floor(10 + Math.random() * 90)}`,
        productId: planData.productId,
        billingCycle: planData.billingCycle || 'Monthly',
        recurringPrice: parseFloat(planData.recurringPrice) || 0,
        status: planData.status || 'Active',
        description: planData.description || ''
      };
      plans.unshift(newPlan);
      this.saveState();
      return newPlan;
    }

    deleteRecurringPlan(id) {
      if (!this.state.subscriptions || !this.state.subscriptions.recurringPlans) return;
      this.state.subscriptions.recurringPlans = this.state.subscriptions.recurringPlans.filter(p => p.id !== id);
      this.saveState();
    }

    toggleRecurringPlanStatus(id) {
      const plan = (this.state.subscriptions?.recurringPlans || []).find(p => p.id === id);
      if (plan) {
        plan.status = plan.status === 'Active' ? 'Inactive' : 'Active';
        this.saveState();
        return plan;
      }
      return null;
    }

    // Customer Subscriptions ("My Subscriptions" Registry)
    getCustomerSubscriptions() {
      if (!this.state.customerSubscriptions) {
        this.state.customerSubscriptions = JSON.parse(JSON.stringify(defaultState.customerSubscriptions || []));
      }
      const products = this.getProducts();
      const plans = this.state.subscriptions?.recurringPlans || [];
      return this.state.customerSubscriptions.map(sub => {
        const product = products.find(p => p.id === sub.productId);
        const plan = plans.find(p => p.id === sub.planId);
        return {
          ...sub,
          product,
          plan
        };
      });
    }

    getCustomerSubscription(id) {
      return this.getCustomerSubscriptions().find(s => s.id === id) || null;
    }

    createCustomerSubscription({ customerName, customerTier = 'Gold', planId, requestedDiscount = null, customStartDate = null }) {
      if (!this.state.customerSubscriptions) {
        this.state.customerSubscriptions = [];
      }
      const plan = this.getRecurringPlan(planId);
      if (!plan) return { success: false, error: 'Recurring plan not found' };

      // Use existing DealFlow360 discount engine
      const effCalc = this.calculateEffectiveDiscount(plan.productId, customerTier);
      const discountPct = requestedDiscount !== null ? parseFloat(requestedDiscount) : effCalc.effectiveMax;
      const finalPrice = Math.round(plan.recurringPrice * (1 - discountPct / 100));

      const now = new Date();
      const startDateStr = customStartDate || now.toISOString().slice(0, 10);
      
      // Calculate next billing date automatically based on cycle
      const nextDate = new Date(startDateStr);
      if (plan.billingCycle === 'Monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (plan.billingCycle === 'Quarterly') {
        nextDate.setMonth(nextDate.getMonth() + 3);
      } else if (plan.billingCycle === 'Yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      const nextBillingDateStr = nextDate.toISOString().slice(0, 10);

      const subId = `SUB-CUST-${Math.floor(100 + Math.random() * 900)}`;
      const invNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const newSub = {
        id: subId,
        customerName,
        customerTier,
        planId: plan.id,
        productId: plan.productId,
        productName: plan.productName,
        billingCycle: plan.billingCycle,
        recurringPrice: plan.recurringPrice,
        discountPct,
        finalPrice,
        startDate: startDateStr,
        nextBillingDate: nextBillingDateStr,
        status: 'Active',
        autoRenew: true,
        lastInvoiceNumber: invNumber
      };

      this.state.customerSubscriptions.unshift(newSub);
      this.saveState();
      return { success: true, subscription: newSub };
    }

    // Automated Backend Business Logic: Mid-cycle Proration Calculation
    calculateProration({ subscriptionId, newPlanId }) {
      const sub = this.getCustomerSubscription(subscriptionId);
      const newPlan = this.getRecurringPlan(newPlanId);
      if (!sub || !newPlan) return null;

      const totalDays = sub.billingCycle === 'Monthly' ? 30 : sub.billingCycle === 'Quarterly' ? 90 : 365;
      const newTotalDays = newPlan.billingCycle === 'Monthly' ? 30 : newPlan.billingCycle === 'Quarterly' ? 90 : 365;

      // Calculate days elapsed & remaining in current cycle
      const start = new Date(sub.startDate);
      const now = new Date();
      const diffTime = Math.max(0, now - start);
      const elapsedDays = Math.min(totalDays, Math.floor(diffTime / (1000 * 60 * 60 * 24)) || 8);
      const remainingDays = Math.max(1, totalDays - elapsedDays);

      const remainingRatio = remainingDays / totalDays;
      const unusedCredit = Math.round(sub.finalPrice * remainingRatio);

      // Compute customer discount for new plan
      const effCalc = this.calculateEffectiveDiscount(newPlan.productId, sub.customerTier);
      const newDiscountedFull = Math.round(newPlan.recurringPrice * (1 - effCalc.effectiveMax / 100));
      const newChargeProrated = Math.round(newDiscountedFull * (remainingDays / newTotalDays));

      const netAdjustment = newChargeProrated - unusedCredit;

      return {
        currentPlanName: sub.productName,
        currentBillingCycle: sub.billingCycle,
        currentPrice: sub.finalPrice,
        newPlanName: newPlan.productName,
        newBillingCycle: newPlan.billingCycle,
        newFullPrice: newDiscountedFull,
        totalDays,
        elapsedDays,
        remainingDays,
        unusedCredit,
        newChargeProrated,
        netAdjustment,
        isCredit: netAdjustment < 0,
        adjustmentAbs: Math.abs(netAdjustment)
      };
    }

    // Apply Mid-Cycle Change (automated execution)
    applyMidCycleChange({ subscriptionId, newPlanId }) {
      const subIdx = (this.state.customerSubscriptions || []).findIndex(s => s.id === subscriptionId);
      if (subIdx === -1) return { success: false, error: 'Subscription not found' };

      const proration = this.calculateProration({ subscriptionId, newPlanId });
      const newPlan = this.getRecurringPlan(newPlanId);
      const sub = this.state.customerSubscriptions[subIdx];

      const effCalc = this.calculateEffectiveDiscount(newPlan.productId, sub.customerTier);
      const newFinalPrice = Math.round(newPlan.recurringPrice * (1 - effCalc.effectiveMax / 100));

      sub.planId = newPlan.id;
      sub.productId = newPlan.productId;
      sub.productName = newPlan.productName;
      sub.billingCycle = newPlan.billingCycle;
      sub.recurringPrice = newPlan.recurringPrice;
      sub.discountPct = effCalc.effectiveMax;
      sub.finalPrice = newFinalPrice;
      sub.lastAdjustment = {
        date: new Date().toISOString().slice(0, 10),
        netAdjustment: proration.netAdjustment,
        note: proration.isCredit 
          ? `Credited $${proration.adjustmentAbs} to account on mid-cycle switch`
          : `Billed $${proration.adjustmentAbs} prorated adjustment`
      };

      this.saveState();
      return { success: true, subscription: sub, proration };
    }

    // Subscription Cancellation Processing
    cancelSubscription({ subscriptionId, reason = 'Customer request' }) {
      const sub = (this.state.customerSubscriptions || []).find(s => s.id === subscriptionId);
      if (!sub) return { success: false, error: 'Subscription not found' };

      sub.status = 'Cancelled';
      sub.cancellation = {
        cancelledAt: new Date().toISOString().slice(0, 10),
        effectiveEndDate: sub.nextBillingDate, // Paid access valid through end of billing period
        reason
      };

      this.saveState();
      return { success: true, subscription: sub, accessValidUntil: sub.nextBillingDate };
    }


    // Customer Tiers
    getCustomerTiers() {
      return this.state.customerTiers;
    }

    saveCustomerTiers(cfg) {
      this.state.customerTiers = { ...this.state.customerTiers, ...cfg };
      this.saveState();
    }

    toggleCustomerMode(customerId) {
      const cust = this.state.customerTiers.customers.find(c => c.id === customerId);
      if (cust) {
        cust.mode = cust.mode === 'Auto' ? 'Manual' : 'Auto';
        this.saveState();
        return cust;
      }
      return null;
    }


    // Anomalies
    getAnomalies() {
      return this.state.anomalies;
    }

    saveAnomalySettings(settings) {
      this.state.anomalies.settings = { ...this.state.anomalies.settings, ...settings };
      this.saveState();
    }

    updateAnomalyStatus(anomalyId, status, note = '') {
      const item = this.state.anomalies.flagged.find(a => a.id === anomalyId);
      if (item) {
        item.status = status;
        if (note) item.reviewNote = note;
        this.saveState();
        return item;
      }
      return null;
    }

    // Analytics
    getAnalytics() {
      return this.state.analytics;
    }
  }

  window.clinchStore = new ClinchStore();
})();
