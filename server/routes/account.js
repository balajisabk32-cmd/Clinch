const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /api/account
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, company, tier, tier_spend, gold_threshold, assigned_rep_id, created_at FROM customers WHERE id = $1',
      [req.customerId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });

    const customer = result.rows[0];
    const tier_spend = parseFloat(customer.tier_spend);
    const gold_threshold = parseFloat(customer.gold_threshold);

    const REP_NAMES = {
      rep_rao: 'A. Rao (Primary Account Owner)',
      rep_iyer: 'K. Iyer (Primary Account Owner)',
      rep_nair: 'S. Nair (Primary Account Owner)',
    };
    const assignedRepName = customer.assigned_rep_id ? (REP_NAMES[customer.assigned_rep_id] || 'Dedicated Account Rep') : 'Unassigned';

    // Tier thresholds
    const TIER_THRESHOLDS = { bronze: 0, silver: 30000, gold: 100000 };
    const nextTier = customer.tier === 'bronze' ? 'silver' : customer.tier === 'silver' ? 'gold' : null;
    const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : gold_threshold;
    const progress = Math.min((tier_spend / nextThreshold) * 100, 100);
    const amountToNext = Math.max(nextThreshold - tier_spend, 0);

    res.json({
      ...customer,
      assigned_rep_name: assignedRepName,
      tier_progress: {
        current_spend: tier_spend,
        next_tier: nextTier,
        next_threshold: nextThreshold,
        progress_pct: progress.toFixed(1),
        amount_to_next: amountToNext,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
