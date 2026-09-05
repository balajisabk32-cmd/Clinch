const { Router } = require('express');
const productController = require('./controller');
const priceListRouter = require('../pricelists/routes');
const {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  validateBody,
} = require('./validation');
const { authenticateInternal, authorizeRoles } = require('../../middleware/auth');

const router = Router();

// =============================================================================
// Nested Price List Router (/api/products/:productId/pricelists)
// =============================================================================
router.use('/:productId/pricelists', priceListRouter);

// =============================================================================
// Variant Endpoints (/api/products/:productId/variants)
// =============================================================================

// List all variants for a product
router.get('/:productId/variants', (req, res, next) => productController.listVariants(req, res, next));

// Add a variant to a product (Admin only)
router.post(
  '/:productId/variants',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(createVariantSchema),
  (req, res, next) => productController.addVariant(req, res, next)
);

// Delete a variant from a product (Admin only)
router.delete(
  '/:productId/variants/:variantId',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  (req, res, next) => productController.deleteVariant(req, res, next)
);

// =============================================================================
// Product Endpoints (/api/products)
// =============================================================================

// List all products with optional filters (?category=Hardware&search=router)
router.get('/', (req, res, next) => productController.list(req, res, next));

// Get single product with its variants and price lists
router.get('/:id', (req, res, next) => productController.getById(req, res, next));

// Create a new product (Admin only)
router.post(
  '/',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(createProductSchema),
  (req, res, next) => productController.create(req, res, next)
);

// Update a product (Admin only)
router.put(
  '/:id',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  validateBody(updateProductSchema),
  (req, res, next) => productController.update(req, res, next)
);

// Delete a product (Admin only, cascades variants and price lists)
router.delete(
  '/:id',
  authenticateInternal,
  authorizeRoles('ADMIN'),
  (req, res, next) => productController.delete(req, res, next)
);

module.exports = router;
