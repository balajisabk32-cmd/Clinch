const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.customerId]
    );
    const unread = result.rows.filter((n) => !n.is_read).length;
    res.json({ notifications: result.rows, unread_count: unread });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE customer_id = $1', [req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND customer_id = $2', [req.params.id, req.customerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
