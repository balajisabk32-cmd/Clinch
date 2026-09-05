const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /api/quotations
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.*, 
              COUNT(qi.id) as item_count
       FROM quotations q
       LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
       WHERE q.customer_id = $1
       GROUP BY q.id
       ORDER BY q.created_at DESC`,
      [req.customerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/quotations/:id — detail with line items
router.get('/:id', auth, async (req, res) => {
  try {
    const qResult = await pool.query(
      'SELECT * FROM quotations WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.customerId]
    );
    if (qResult.rowCount === 0) return res.status(404).json({ error: 'Quotation not found' });

    const itemsResult = await pool.query(
      `SELECT qi.*, p.image_url, p.category
       FROM quotation_items qi
       LEFT JOIN products p ON qi.product_id = p.id
       WHERE qi.quotation_id = $1`,
      [req.params.id]
    );

    res.json({ ...qResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/quotations/:id/negotiate — submit discount request and/or line comments
router.put('/:id/negotiate', auth, async (req, res) => {
  const { counter_discount, line_comments } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // If customer requested a discount, set discount_request_status = 'pending_approval'
    // Main quotation status remains 'under_negotiation'
    if (counter_discount !== undefined && counter_discount !== null && counter_discount !== '') {
      await client.query(
        `UPDATE quotations 
         SET status = 'under_negotiation',
             discount_request_status = 'pending_approval',
             requested_discount = $1,
             counter_discount = NULL,
             counter_notes = NULL,
             updated_at = NOW() 
         WHERE id = $2 AND customer_id = $3`,
        [parseFloat(counter_discount), req.params.id, req.customerId]
      );
    } else {
      await client.query(
        `UPDATE quotations 
         SET status = 'under_negotiation',
             updated_at = NOW() 
         WHERE id = $1 AND customer_id = $2`,
        [req.params.id, req.customerId]
      );
    }

    if (line_comments && Array.isArray(line_comments)) {
      for (const lc of line_comments) {
        if (lc.comment !== undefined) {
          await client.query(
            'UPDATE quotation_items SET customer_comment = $1 WHERE id = $2 AND quotation_id = $3',
            [lc.comment, lc.item_id, req.params.id]
          );
        }
      }
    }

    // Add notification
    if (counter_discount) {
      await client.query(
        `INSERT INTO notifications (customer_id, message, type) 
         VALUES ($1, $2, 'info')`,
        [req.customerId, `💬 Your discount request of ${counter_discount}% for quotation #${req.params.id} has been submitted for Sales Manager review.`]
      );
    }

    await client.query('COMMIT');

    const updatedQ = await pool.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    res.json({ ...updatedQ.rows[0], message: 'Discount request submitted to Sales Manager for review' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/quotations/:id/manager-approve — sales manager approval
router.put('/:id/manager-approve', auth, async (req, res) => {
  try {
    const qResult = await pool.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    if (qResult.rowCount === 0) return res.status(404).json({ error: 'Quotation not found' });
    const quote = qResult.rows[0];

    // Branch A: Active discount request waiting for manager decision
    if (quote.discount_request_status === 'pending_approval') {
      const approvedDiscount = Number(quote.requested_discount || quote.discount_applied || 0);

      // Recalculate quote total with approved discount
      const itemsResult = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [req.params.id]);
      let newTotal = 0;
      for (const item of itemsResult.rows) {
        newTotal += Number(item.unit_price) * Number(item.quantity) * (1 - approvedDiscount / 100);
      }

      await pool.query(
        `UPDATE quotations 
         SET discount_request_status = 'approved',
             discount_applied = $1,
             total_amount = $2,
             rep_notes = 'Sales Manager approved requested discount of ' || $1 || '%. Please review and confirm the updated quotation.',
             updated_at = NOW() 
         WHERE id = $3`,
        [approvedDiscount, Math.round(newTotal * 100) / 100, req.params.id]
      );

      await pool.query(
        `INSERT INTO notifications (customer_id, message, type) VALUES ($1, $2, 'upgrade')`,
        [quote.customer_id, `🎉 Sales Manager approved your ${approvedDiscount}% discount request for Quote #${quote.quote_number}!`]
      );

      return res.json({ message: 'Requested discount approved by Sales Manager!' });
    }

    // Branch B: Initial quotation awaiting manager review (pending_review)
    await pool.query(
      `UPDATE quotations 
       SET status = 'sent', 
           rep_notes = 'Quotation approved by Sales Manager and is now ready for negotiation.', 
           updated_at = NOW() 
       WHERE id = $1`,
      [req.params.id]
    );

    await pool.query(
      `INSERT INTO notifications (customer_id, message, type) VALUES ($1, $2, 'info')`,
      [quote.customer_id, `📋 Quotation #${quote.quote_number} has been approved by the Sales Manager and is now ready for negotiation.`]
    );

    res.json({ message: 'Quotation approved by Sales Manager! Ready for negotiation.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/quotations/:id/manager-counter — sales manager provides counter offer
router.put('/:id/manager-counter', auth, async (req, res) => {
  try {
    const qResult = await pool.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    if (qResult.rowCount === 0) return res.status(404).json({ error: 'Quotation not found' });
    const quote = qResult.rows[0];

    const requested = Number(quote.requested_discount || 15);
    const counterDiscount = req.body.counter_discount !== undefined
      ? Number(req.body.counter_discount)
      : Math.max(Number(quote.discount_applied || 0) + 2, requested - 3);

    const counterNotes = req.body.counter_notes || `Sales Manager has provided a counter offer of ${counterDiscount}% bulk discount.`;

    await pool.query(
      `UPDATE quotations 
       SET discount_request_status = 'counter_offer',
           counter_discount = $1,
           counter_notes = $2,
           updated_at = NOW() 
       WHERE id = $3`,
      [counterDiscount, counterNotes, req.params.id]
    );

    await pool.query(
      `INSERT INTO notifications (customer_id, message, type) VALUES ($1, $2, 'info')`,
      [quote.customer_id, `💬 Sales Manager provided a counter offer of ${counterDiscount}% for Quote #${quote.quote_number}.`]
    );

    res.json({ message: 'Counter offer provided by Sales Manager', counter_discount: counterDiscount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/quotations/:id/manager-reject — sales manager rejects discount request
router.put('/:id/manager-reject', auth, async (req, res) => {
  try {
    const qResult = await pool.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    if (qResult.rowCount === 0) return res.status(404).json({ error: 'Quotation not found' });
    const quote = qResult.rows[0];

    await pool.query(
      `UPDATE quotations 
       SET discount_request_status = 'rejected',
           counter_notes = 'Your requested discount was not approved. The previous quotation remains available.',
           updated_at = NOW() 
       WHERE id = $1`,
      [req.params.id]
    );

    await pool.query(
      `INSERT INTO notifications (customer_id, message, type) VALUES ($1, $2, 'warning')`,
      [quote.customer_id, `⚠️ Requested discount for Quote #${quote.quote_number} was not approved. Previous quotation remains available.`]
    );

    res.json({ message: 'Discount request marked as rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/quotations/:id/accept-counter — customer accepts counter offer
router.put('/:id/accept-counter', auth, async (req, res) => {
  try {
    const qResult = await pool.query('SELECT * FROM quotations WHERE id = $1 AND customer_id = $2', [req.params.id, req.customerId]);
    if (qResult.rowCount === 0) return res.status(404).json({ error: 'Quotation not found' });
    const quote = qResult.rows[0];

    if (!quote.counter_discount) {
      return res.status(400).json({ error: 'No counter offer available to accept' });
    }

    const acceptedDiscount = Number(quote.counter_discount);

    // Recalculate quote total with the accepted counter discount
    const itemsResult = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [req.params.id]);
    let newTotal = 0;
    for (const item of itemsResult.rows) {
      newTotal += Number(item.unit_price) * Number(item.quantity) * (1 - acceptedDiscount / 100);
    }

    await pool.query(
      `UPDATE quotations 
       SET discount_applied = $1,
           total_amount = $2,
           discount_request_status = 'approved',
           rep_notes = 'Customer accepted Sales Manager counter offer of ' || $1 || '%. Please confirm and place order.',
           updated_at = NOW() 
       WHERE id = $3`,
      [acceptedDiscount, Math.round(newTotal * 100) / 100, req.params.id]
    );

    await pool.query(
      `INSERT INTO notifications (customer_id, message, type) VALUES ($1, $2, 'success')`,
      [req.customerId, `✅ Counter offer of ${acceptedDiscount}% accepted for Quote #${quote.quote_number}. Ready to place order.`]
    );

    res.json({ message: `Accepted counter offer of ${acceptedDiscount}%! Updated quotation is ready.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/quotations/:id/confirm — customer confirms quotation
router.put('/:id/confirm', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const qResult = await client.query(
      'SELECT * FROM quotations WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.customerId]
    );
    if (qResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const quotation = qResult.rows[0];

    // Transition quotation to confirmed / fulfillment
    await client.query(
      `UPDATE quotations SET status = 'fulfillment', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    // Create order
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 7);

    // If discount > 15%, route order to pending_approval hold, otherwise processing
    const isHighDiscount = parseFloat(quotation.discount_applied || 0) > 15;
    const orderStatus = isHighDiscount ? 'pending_approval' : 'processing';
    const warehouseInfo = isHighDiscount
      ? JSON.stringify([{ warehouse: 'Awaiting Manager Commercial Release', code: 'HOLD-MGR-APPV', items: ['High-discount enterprise release hold'] }])
      : JSON.stringify([{ warehouse: 'Tech Logistics Depot', code: 'TLD-HUB-01', items: ['All items queued for dispatch'] }]);

    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, quotation_id, order_number, status, warehouse_info, estimated_delivery)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        req.customerId, req.params.id, orderNumber,
        orderStatus, warehouseInfo, estimatedDelivery,
      ]
    );

    // Confirmation notification
    await client.query(
      `INSERT INTO notifications (customer_id, message, type) VALUES ($1,$2,'success')`,
      [req.customerId, `✅ Quotation #${quotation.quote_number} confirmed! Order #${orderNumber} generated.`]
    );

    // Update tier spend
    await client.query(
      'UPDATE customers SET tier_spend = tier_spend + $1 WHERE id = $2',
      [quotation.total_amount, req.customerId]
    );

    // Auto-upgrade tier
    const custResult = await client.query('SELECT tier_spend, gold_threshold FROM customers WHERE id = $1', [req.customerId]);
    const { tier_spend, gold_threshold } = custResult.rows[0];
    if (parseFloat(tier_spend) >= parseFloat(gold_threshold)) {
      await client.query('UPDATE customers SET tier = $1 WHERE id = $2', ['gold', req.customerId]);
      await client.query(
        `INSERT INTO notifications (customer_id, message, type) VALUES ($1,'🏆 Congratulations! You have been upgraded to Gold Tier!','upgrade')`,
        [req.customerId]
      );
    }

    await client.query('COMMIT');

    res.json({
      status: 'fulfillment',
      order: orderResult.rows[0],
      message: 'Quotation accepted! Your order has been created.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
