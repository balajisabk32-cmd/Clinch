const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
require('dotenv').config();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    if (result.rowCount === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const customer = result.rows[0];
    const match = await bcrypt.compare(password, customer.password_hash);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: customer.id, email: customer.email, tier: customer.tier },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        company: customer.company,
        tier: customer.tier,
        tier_spend: customer.tier_spend,
        gold_threshold: customer.gold_threshold,
        assigned_rep_id: customer.assigned_rep_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, company, assigned_rep_id } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    // If assigned_rep_id not specified, self-signup defaults to null (unassigned)
    const repId = assigned_rep_id || null;

    const result = await pool.query(
      `INSERT INTO customers (name, email, password_hash, company, tier, assigned_rep_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name || email.split('@')[0], email, hash, company || 'Independent', 'bronze', repId]
    );

    const customer = result.rows[0];
    const token = jwt.sign(
      { id: customer.id, email: customer.email, tier: customer.tier },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        company: customer.company,
        tier: customer.tier,
        assigned_rep_id: customer.assigned_rep_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/magic-link (demo: returns a fake link token in response)
router.post('/magic-link', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: 'No account found with this email' });

    const customer = result.rows[0];
    const magicToken = jwt.sign(
      { id: customer.id, email: customer.email, tier: customer.tier },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // In production, email this link. For demo, return it.
    console.log(`🔗 Magic link token for ${email}: ${magicToken}`);
    res.json({ message: 'Magic link sent! (Demo: token returned)', token: magicToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
