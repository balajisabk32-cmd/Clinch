const { Router } = require('express');
const discountTierController = require('../discount-tiers/controller');
const { setCategoryLimitSchema, validateBody } = require('../discount-tiers/validation');
const { authenticateInternal, authorizeRoles } = require('../../middleware/auth');

const router = Router();

// List all category discount limits
router.get('/', (req, res, next) => discountTierController.listCategories(req, res, next));

// Get limit for one category (e.g. GET /api/category-discount-limits/Hardware)
router.get('/:category', (req, res, next) => discountTierController.getCategory(req, res, next));

// Create or update a category's max discount (Admin only)
router.post(
  '/',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(setCategoryLimitSchema),
  (req, res, next) => discountTierController.upsertCategory(req, res, next)
);

module.exports = router;
