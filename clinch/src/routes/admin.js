const express = require("express");
const store = require("../db/store");

const router = express.Router();

// POST /api/admin/reset-seed - reloads seed JSON from disk and re-resolves
// relative dates ("8 days ago") against the current time. Handy if the demo
// data is edited between rehearsals, or the server has been up for a while.
router.post("/reset-seed", (req, res) => {
  const state = store.reset();
  res.json({
    message: "Seed data reloaded.",
    counts: {
      customers: state.customers.length,
      salesReps: state.salesReps.length,
      products: state.products.length,
      warehouses: state.warehouses.length,
      deals: state.deals.length,
    },
  });
});

module.exports = router;
