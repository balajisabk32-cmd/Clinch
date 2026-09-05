const { Router } = require('express');
const priceListController = require('./controller');
const { setTierPriceSchema, validateBody } = require('../products/validation');
const { authenticateInternal, authorizeRoles } = require('../../middleware/auth');

// mergeParams: true ensures :productId from parent router is available here
const router = Router({ mergeParams: true });

// Resolve effective price for a product and tier (e.g. GET /api/products/:productId/pricelists/resolve?tier=GOLD)
router.get('/resolve', (req, res, next) => priceListController.resolve(req, res, next));

// Set/Upsert tier price for a product (Admin only)
router.post(
  '/',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(setTierPriceSchema),
  (req, res, next) => priceListController.setTierPrice(req, res, next)
);

// Get all tier prices configured for a product
router.get('/', (req, res, next) => priceListController.getTierPrices(req, res, next));

module.exports = router;
