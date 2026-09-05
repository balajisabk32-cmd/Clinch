const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /api/orders — list all orders for customer
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, q.quote_number, q.total_amount, q.discount_applied
       FROM orders o
       LEFT JOIN quotations q ON o.quotation_id = q.id
       WHERE o.customer_id = $1
       ORDER BY o.created_at DESC`,
      [req.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id — order detail + tracking
router.get('/:id', auth, async (req, res) => {
  try {
    const orderResult = await pool.query(
      `SELECT o.*, q.quote_number, q.total_amount, q.discount_applied
       FROM orders o
       LEFT JOIN quotations q ON o.quotation_id = q.id
       WHERE o.id = $1 AND o.customer_id = $2`,
      [req.params.id, req.customerId]
    );
    if (orderResult.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderResult.rows[0];

    // Get quotation items for this order
    const itemsResult = await pool.query(
      `SELECT qi.*, p.image_url FROM quotation_items qi
       LEFT JOIN products p ON qi.product_id = p.id
       WHERE qi.quotation_id = $1`,
      [order.quotation_id]
    );

    const TRACKING_STEPS = ['pending_approval', 'processing', 'warehouse_assigned', 'shipped', 'delivered'];
    const currentStep = TRACKING_STEPS.indexOf(order.status);

    res.json({
      ...order,
      items: itemsResult.rows,
      tracking_steps: TRACKING_STEPS,
      current_step: currentStep,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/orders/:id/manager-approve — simulate sales manager approving order on hold
router.put('/:id/manager-approve', auth, async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.customerId]
    );
    if (check.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = check.rows[0];

    await pool.query(
      `UPDATE orders 
       SET status = 'processing',
           warehouse_info = $1,
           updated_at = datetime('now')
       WHERE id = $2`,
      [
        JSON.stringify([
          {
            warehouse: 'Tech Logistics Central Hub',
            code: 'HUB-MUM-RELEASED',
            items: ['Sales Director Sign-off Complete — Released to Dispatch Queue']
          }
        ]),
        req.params.id
      ]
    );

    // Add notification
    await pool.query(
      `INSERT INTO notifications (customer_id, message, type)
       VALUES ($1, $2, 'upgrade')`,
      [
        req.customerId,
        `✅ Sales Manager approved Order #${order.order_number}! Commercial hold lifted and moved to Processing.`
      ]
    );

    res.json({ message: 'Order approved by manager and moved to processing' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

