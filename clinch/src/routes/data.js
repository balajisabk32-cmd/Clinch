/**
 * Read-only passthrough endpoints over the seed/demo dataset.
 *
 * These are NOT business-logic endpoints - they exist so Balaji/Nithin/
 * Santhosh can pull the same demo entities (customers, reps, products,
 * deals) into their own services during the hackathon without everyone
 * hand-copying JSON. If/when a shared database exists, these can be
 * deleted or repointed at it; the reporting routes don't depend on them.
 */
const express = require("express");
const store = require("../db/store");
const { enrichedDeals } = require("../services/reportingService");

const router = express.Router();

router.get("/customers", (req, res) => res.json(store.get().customers));
router.get("/sales-reps", (req, res) => res.json(store.get().salesReps));
router.get("/products", (req, res) => res.json(store.get().products));
router.get("/warehouses", (req, res) => res.json(store.get().warehouses));

router.get("/deals", (req, res) => res.json(enrichedDeals()));
router.get("/deals/:id", (req, res) => {
  const deal = enrichedDeals().find((d) => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  res.json(deal);
});

module.exports = router;
