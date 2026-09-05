const { Router } = require('express');
const approvalChainController = require('./controller');
const {
  createApprovalRuleSchema,
  updateApprovalRuleSchema,
  validateBody,
} = require('./validation');
const { authenticateInternal, authorizeRoles } = require('../../middleware/auth');

const router = Router();

// =============================================================================
// Read Endpoints (Internal / Intelligence Layer)
// =============================================================================

// Resolve matching approval requirements for a given discount percentage
// Must come before /:id route
router.get('/resolve', (req, res, next) => approvalChainController.resolve(req, res, next));

// List all approval rules ordered by minDiscountPercent ascending
router.get('/', (req, res, next) => approvalChainController.list(req, res, next));

// Get single rule by ID
router.get('/:id', (req, res, next) => approvalChainController.getById(req, res, next));

// =============================================================================
// Write Endpoints (Admin Only)
// =============================================================================

// Create a new approval chain rule
router.post(
  '/',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(createApprovalRuleSchema),
  (req, res, next) => approvalChainController.create(req, res, next)
);

// Update an existing approval chain rule
router.put(
  '/:id',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(updateApprovalRuleSchema),
  (req, res, next) => approvalChainController.update(req, res, next)
);

// Delete an approval chain rule
router.delete(
  '/:id',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  (req, res, next) => approvalChainController.delete(req, res, next)
);

module.exports = router;
