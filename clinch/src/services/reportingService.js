/**
 * Reporting / Dashboard data aggregation service.
 *
 * IMPORTANT SCOPE NOTE:
 * This file does NOT compute risk scores, does NOT run approval routing,
 * and does NOT decide warehouse allocation. It only reads fields that are
 * produced elsewhere (riskScore/riskLevel from Balaji's engine, approvalStage
 * from Nithin's state machine, warehouseSplit from Santhosh's fulfillment
 * logic) and aggregates/categorizes them for the Deal Health Dashboard.
 *
 * The one piece of "logic" here is `classifyHealth()`, which buckets a deal
 * into HEALTHY / AT_RISK / STALLED / CLOSED_LOST for dashboard purposes.
 * That's a reporting/categorization rule (how do we summarize a deal's
 * status for a health dashboard), not a risk-scoring algorithm - it never
 * invents a risk score, it only reads riskLevel if one is already present.
 */
const store = require("../db/store");
const { average, byId, daysSince } = require("../utils/helpers");

const STALLED_THRESHOLD_DAYS = 5;
const RISKY_LEVELS = new Set(["HIGH", "MEDIUM"]);
const OPEN_STAGES = new Set(["OPEN", "PENDING_APPROVAL"]);

function classifyHealth(deal) {
  if (deal.stage === "REJECTED" || deal.stage === "CLOSED_LOST") {
    return "CLOSED_LOST";
  }
  if (OPEN_STAGES.has(deal.stage)) {
    if (daysSince(deal.lastActivityAt) >= STALLED_THRESHOLD_DAYS) return "STALLED";
    if (deal.riskLevel && RISKY_LEVELS.has(deal.riskLevel)) return "AT_RISK";
    return "HEALTHY";
  }
  // APPROVED, FULFILLED, SUBSCRIBED, CLOSED_WON -> successfully progressing/closed-won
  return "HEALTHY";
}

function enrichedDeals() {
  const { deals, customers, salesReps } = store.get();
  const customerMap = byId(customers);
  const repMap = byId(salesReps);

  return deals.map((deal) => {
    const customer = customerMap.get(deal.customerId);
    const rep = repMap.get(deal.salesRepId);
    return {
      ...deal,
      customerName: customer ? customer.name : "Unknown Customer",
      salesRepName: rep ? rep.name : "Unknown Rep",
      daysSinceLastActivity: daysSince(deal.lastActivityAt),
      healthCategory: classifyHealth(deal),
    };
  });
}

function getDealHealthSummary() {
  const deals = enrichedDeals();
  const counts = { HEALTHY: 0, AT_RISK: 0, STALLED: 0, CLOSED_LOST: 0 };
  for (const d of deals) counts[d.healthCategory]++;

  const discounts = deals.map((d) => d.discountPercent);
  const openPipelineValue = deals
    .filter((d) => d.healthCategory !== "CLOSED_LOST")
    .reduce((sum, d) => sum + d.value, 0);

  return {
    totalDeals: deals.length,
    healthyDeals: counts.HEALTHY,
    atRiskDeals: counts.AT_RISK,
    stalledDeals: counts.STALLED,
    closedLostDeals: counts.CLOSED_LOST,
    averageDiscount: average(discounts),
    openPipelineValue,
    currency: "INR",
    generatedAt: new Date().toISOString(),
  };
}

function getStalledDeals() {
  return enrichedDeals()
    .filter((d) => d.healthCategory === "STALLED")
    .map((d) => ({
      dealId: d.id,
      customerName: d.customerName,
      salesRep: d.salesRepName,
      value: d.value,
      daysStalled: d.daysSinceLastActivity,
      status: "STALLED",
    }))
    .sort((a, b) => b.daysStalled - a.daysStalled);
}

function getAtRiskDeals() {
  return enrichedDeals()
    .filter((d) => d.healthCategory === "AT_RISK")
    .map((d) => ({
      dealId: d.id,
      customerName: d.customerName,
      salesRep: d.salesRepName,
      discount: d.discountPercent,
      riskScore: d.riskScore,
      riskLevel: d.riskLevel,
      riskExplanation: d.riskExplanation,
      approvalStage: d.approvalStage,
      status: "AT_RISK",
    }))
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
}

function getSalesRepDiscountHistory() {
  const { salesReps, deals } = store.get();
  const dealsByRep = new Map();
  for (const d of deals) {
    if (!dealsByRep.has(d.salesRepId)) dealsByRep.set(d.salesRepId, []);
    dealsByRep.get(d.salesRepId).push(d.discountPercent);
  }

  return salesReps.map((rep) => {
    const currentDealDiscounts = dealsByRep.get(rep.id) || [];
    const discountHistory = [...rep.historicalDiscounts, ...currentDealDiscounts];
    return {
      salesRepId: rep.id,
      salesRepName: rep.name,
      totalDeals: discountHistory.length,
      averageDiscount: average(discountHistory),
      highestDiscount: Math.max(...discountHistory),
      discountHistory,
    };
  });
}

function getDealStatusDistribution() {
  const deals = enrichedDeals();

  const byStage = {};
  const byHealthCategory = { HEALTHY: 0, AT_RISK: 0, STALLED: 0, CLOSED_LOST: 0 };

  for (const d of deals) {
    byStage[d.stage] = (byStage[d.stage] || 0) + 1;
    byHealthCategory[d.healthCategory]++;
  }

  return {
    byStage: Object.entries(byStage).map(([stage, count]) => ({ stage, count })),
    byHealthCategory: Object.entries(byHealthCategory).map(([healthCategory, count]) => ({
      healthCategory,
      count,
    })),
    totalDeals: deals.length,
  };
}

function getDashboard() {
  return {
    summary: getDealHealthSummary(),
    atRiskDeals: getAtRiskDeals(),
    stalledDeals: getStalledDeals(),
    salesRepDiscountHistory: getSalesRepDiscountHistory(),
    statusDistribution: getDealStatusDistribution(),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  classifyHealth,
  enrichedDeals,
  getDealHealthSummary,
  getStalledDeals,
  getAtRiskDeals,
  getSalesRepDiscountHistory,
  getDealStatusDistribution,
  getDashboard,
};
