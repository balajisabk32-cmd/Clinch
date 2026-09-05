const { Router } = require('express');
const discountTierController = require('./controller');
const { setTierLimitSchema, validateBody } = require('./validation');
const { authenticateInternal, authorizeRoles } = require('../../middleware/auth');

const router = Router();

// List all tier limits (Public or internal read)
router.get('/', (req, res, next) => discountTierController.listTiers(req, res, next));

// Get limit for one tier (e.g. GET /api/discount-tiers/GOLD)
router.get('/:tier', (req, res, next) => discountTierController.getTier(req, res, next));

// Create or update a tier's max discount (Admin only)
router.post(
  '/',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(setTierLimitSchema),
  (req, res, next) => discountTierController.upsertTier(req, res, next)
);

module.exports = router;
