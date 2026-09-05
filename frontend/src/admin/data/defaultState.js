export const defaultState = {
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
