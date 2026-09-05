const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /api/cart
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ci.*, p.name, p.image_url, p.category,
              p.bronze_price, p.silver_price, p.gold_price, p.base_price,
              pv.variant_type, pv.variant_value, pv.price_modifier
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.customer_id = $1
       ORDER BY ci.created_at DESC`,
      [req.customerId]
    );

    const c = await pool.query('SELECT tier FROM customers WHERE id = $1', [req.customerId]);
    const tier = c.rows[0]?.tier || 'bronze';

    const items = result.rows.map((item) => {
      let basePrice =
        tier === 'gold' ? item.gold_price :
        tier === 'silver' ? item.silver_price : item.bronze_price;
      basePrice = parseFloat(basePrice || item.base_price);
      const priceModifier = parseFloat(item.price_modifier || 0);
      return { ...item, unit_price: basePrice + priceModifier };
    });

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cart — add item
router.post('/', auth, async (req, res) => {
  const { product_id, variant_id = null, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id required' });

  try {
    const existing = variant_id
      ? await pool.query(
          'SELECT * FROM cart_items WHERE customer_id=$1 AND product_id=$2 AND variant_id=$3',
          [req.customerId, product_id, variant_id]
        )
      : await pool.query(
          'SELECT * FROM cart_items WHERE customer_id=$1 AND product_id=$2 AND variant_id IS NULL',
          [req.customerId, product_id]
        );

    if (existing.rowCount > 0) {
      const updated = await pool.query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2 RETURNING *',
        [quantity, existing.rows[0].id]
      );
      return res.json(updated.rows[0]);
    }

    const result = await pool.query(
      'INSERT INTO cart_items (customer_id, product_id, variant_id, quantity) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.customerId, product_id, variant_id, quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/cart/:id — update quantity or suggested_discount
router.put('/:id', auth, async (req, res) => {
  const { quantity, suggested_discount } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (quantity !== undefined) { fields.push(`quantity = $${idx++}`); values.push(quantity); }
    if (suggested_discount !== undefined) { fields.push(`suggested_discount = $${idx++}`); values.push(suggested_discount); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.params.id, req.customerId);
    const result = await pool.query(
      `UPDATE cart_items SET ${fields.join(', ')} WHERE id = $${idx} AND customer_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cart item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/cart/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE id = $1 AND customer_id = $2', [req.params.id, req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/cart/clear/all — clear entire cart
router.delete('/clear/all', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE customer_id = $1', [req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cart/submit-quote — convert cart to quotation
router.post('/submit-quote', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cartResult = await client.query(
      `SELECT ci.*, p.name, p.bronze_price, p.silver_price, p.gold_price, p.base_price, pv.price_modifier
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.customer_id = $1`,
      [req.customerId]
    );

    if (cartResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const custResult = await client.query('SELECT * FROM customers WHERE id = $1', [req.customerId]);
    const customer = custResult.rows[0];
    const tier = customer.tier;
    const assignedRepId = customer.assigned_rep_id || null;

    const quoteNumber = `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    let totalAmount = 0;
    const items = cartResult.rows.map((item) => {
      let basePrice = tier === 'gold' ? item.gold_price : tier === 'silver' ? item.silver_price : item.bronze_price;
      basePrice = parseFloat(basePrice || item.base_price) + parseFloat(item.price_modifier || 0);
      const discount = parseFloat(item.suggested_discount || 0);
      const lineTotal = basePrice * item.quantity * (1 - discount / 100);
      totalAmount += lineTotal;
      return { product_id: item.product_id, name: item.name, quantity: item.quantity, unit_price: basePrice, discount_pct: discount };
    });

    const avgDiscount = items.reduce((s, i) => s + i.discount_pct, 0) / items.length;

    const qResult = await client.query(
      'INSERT INTO quotations (customer_id, quote_number, status, total_amount, discount_applied, assigned_rep_id, source) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.customerId, quoteNumber, 'pending_review', totalAmount.toFixed(2), avgDiscount.toFixed(2), assignedRepId, 'Customer Request']
    );
    const quotationId = qResult.rows[0].id;

    for (const item of items) {
      await client.query(
        'INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct) VALUES ($1,$2,$3,$4,$5,$6)',
        [quotationId, item.product_id, item.name, item.quantity, item.unit_price, item.discount_pct]
      );
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE customer_id = $1', [req.customerId]);

    await client.query('COMMIT');

    // Instantly notify Clinch deal engine to synchronize the new quote for sales reps & finance
    try {
      const http = require('http');
      const postData = JSON.stringify({ 
        quote_number: quoteNumber, 
        quotation_id: quotationId,
        assigned_rep_id: assignedRepId,
        source: 'Customer Request'
      });
      const clinchReq = http.request({
        hostname: '127.0.0.1',
        port: 8000,
        path: '/quotes/from-customer',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        timeout: 2000,
      });
      clinchReq.on('error', () => {});
      clinchReq.write(postData);
      clinchReq.end();
    } catch (notifyErr) {}

    res.status(201).json({ quote_number: quoteNumber, quotation_id: quotationId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
