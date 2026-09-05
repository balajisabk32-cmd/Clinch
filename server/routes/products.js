const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// Helper: get tier-based price
const getTierPrice = (product, tier) => {
  if (tier === 'gold') return parseFloat(product.gold_price || product.base_price);
  if (tier === 'silver') return parseFloat(product.silver_price || product.base_price);
  return parseFloat(product.bronze_price || product.base_price);
};

// GET /api/products — with filters, sort, search, pagination
router.get('/', auth, async (req, res) => {
  const { search, category, brand, min_price, max_price, sort = 'popular', page = 1, limit = 50 } = req.query;
  const tier = req.customerTier || 'bronze';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx} OR brand ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (category && category !== 'all') {
    const categories = Array.isArray(category) ? category : category.split(',').filter(Boolean);
    if (categories.length > 0) {
      const placeholders = categories.map(() => `$${idx++}`).join(', ');
      conditions.push(`category IN (${placeholders})`);
      params.push(...categories);
    }
  }
  if (brand && brand !== 'all') {
    const brands = Array.isArray(brand) ? brand : brand.split(',').filter(Boolean);
    if (brands.length > 0) {
      const placeholders = brands.map(() => `$${idx++}`).join(', ');
      conditions.push(`brand IN (${placeholders})`);
      params.push(...brands);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderClause = 'ORDER BY id ASC';
  if (sort === 'price_asc') {
    const col = tier === 'gold' ? 'gold_price' : tier === 'silver' ? 'silver_price' : 'bronze_price';
    orderClause = `ORDER BY ${col} ASC`;
  } else if (sort === 'price_desc') {
    const col = tier === 'gold' ? 'gold_price' : tier === 'silver' ? 'silver_price' : 'bronze_price';
    orderClause = `ORDER BY ${col} DESC`;
  } else if (sort === 'popular') {
    orderClause = 'ORDER BY rating DESC, review_count DESC';
  } else if (sort === 'newest') {
    orderClause = 'ORDER BY created_at DESC';
  }

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT * FROM products ${whereClause} ${orderClause} LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const products = result.rows.map((p) => ({
      ...p,
      tier_price: getTierPrice(p, tier),
      base_price: parseFloat(p.base_price),
      original_price: p.original_price ? parseFloat(p.original_price) : null,
      rating: parseFloat(p.rating || 4.8),
    }));

    // Filter by price after tier pricing
    const filtered = (min_price || max_price)
      ? products.filter((p) => {
          if (min_price && p.tier_price < parseFloat(min_price)) return false;
          if (max_price && p.tier_price > parseFloat(max_price)) return false;
          return true;
        })
      : products;

    res.json({ products: filtered, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/categories — distinct categories (Hardware, Software)
router.get('/categories', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
    res.json(result.rows.map((r) => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/brands — distinct brands
router.get('/brands', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL ORDER BY brand');
    res.json(result.rows.map((r) => r.brand));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/:id — product detail + variants + reviews
router.get('/:id', auth, async (req, res) => {
  const tier = req.customerTier || 'bronze';
  try {
    const pResult = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (pResult.rowCount === 0) return res.status(404).json({ error: 'Product not found' });

    const product = pResult.rows[0];

    const variantsResult = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = $1',
      [req.params.id]
    );

    const reviewsResult = await pool.query(
      'SELECT * FROM product_reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      ...product,
      tier_price: getTierPrice(product, tier),
      base_price: parseFloat(product.base_price),
      original_price: product.original_price ? parseFloat(product.original_price) : null,
      rating: parseFloat(product.rating || 4.8),
      variants: variantsResult.rows,
      reviews: reviewsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
