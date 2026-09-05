const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /api/wishlist
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wi.id, wi.product_id, wi.created_at,
              p.name, p.image_url, p.category, p.rating, p.review_count,
              p.base_price, p.bronze_price, p.silver_price, p.gold_price
       FROM wishlist_items wi
       JOIN products p ON wi.product_id = p.id
       WHERE wi.customer_id = $1
       ORDER BY wi.created_at DESC`,
      [req.customerId]
    );

    const c = await pool.query('SELECT tier FROM customers WHERE id = $1', [req.customerId]);
    const tier = c.rows[0]?.tier || 'bronze';

    const items = result.rows.map((item) => ({
      ...item,
      tier_price: parseFloat(
        tier === 'gold' ? item.gold_price :
        tier === 'silver' ? item.silver_price : item.bronze_price
      ) || parseFloat(item.base_price),
    }));

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/wishlist
router.post('/', auth, async (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id required' });

  try {
    const result = await pool.query(
      'INSERT INTO wishlist_items (customer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *',
      [req.customerId, product_id]
    );
    res.status(201).json(result.rows[0] || { message: 'Already in wishlist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/wishlist/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist_items WHERE id = $1 AND customer_id = $2', [req.params.id, req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/wishlist/by-product/:productId
router.delete('/by-product/:productId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist_items WHERE product_id = $1 AND customer_id = $2', [req.params.productId, req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
