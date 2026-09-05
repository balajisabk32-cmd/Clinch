const express = require("express");
const reportingService = require("../services/reportingService");

const router = express.Router();

router.get("/deal-health-summary", (req, res) => {
  res.json(reportingService.getDealHealthSummary());
});

router.get("/stalled-deals", (req, res) => {
  res.json(reportingService.getStalledDeals());
});

router.get("/at-risk-deals", (req, res) => {
  res.json(reportingService.getAtRiskDeals());
});

router.get("/sales-rep-discount-history", (req, res) => {
  res.json(reportingService.getSalesRepDiscountHistory());
});

router.get("/deal-status-distribution", (req, res) => {
  res.json(reportingService.getDealStatusDistribution());
});

router.get("/dashboard", (req, res) => {
  res.json(reportingService.getDashboard());
});

module.exports = router;
