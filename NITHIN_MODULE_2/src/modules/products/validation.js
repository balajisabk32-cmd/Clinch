const { z } = require('zod');
const { BadRequestError } = require('../../utils/errors');

// Create Product Schema
const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters'),
  category: z.string().trim().min(2, 'Category must be at least 2 characters'),
  basePrice: z.coerce.number().positive('Base price must be a positive number'),
  unit: z.string().trim().min(1, 'Unit is required').default('piece'),
  taxPercent: z.coerce.number().min(0, 'Tax percent cannot be negative').max(100, 'Tax percent cannot exceed 100').default(0.0),
  description: z.string().trim().optional(),
});

// Update Product Schema
const updateProductSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').optional(),
  category: z.string().trim().min(2, 'Category must be at least 2 characters').optional(),
  basePrice: z.coerce.number().positive('Base price must be a positive number').optional(),
  unit: z.string().trim().min(1, 'Unit cannot be empty').optional(),
  taxPercent: z.coerce.number().min(0, 'Tax percent cannot be negative').max(100, 'Tax percent cannot exceed 100').optional(),
  description: z.string().trim().optional(),
});

// Create Variant Schema
const createVariantSchema = z.object({
  attributeName: z.string().trim().min(1, 'Attribute name is required (e.g. Size, Port Configuration)'),
  attributeValue: z.string().trim().min(1, 'Attribute value is required (e.g. 24-Port, Large)'),
  extraPrice: z.coerce.number().min(0, 'Extra price must be zero or a positive number').default(0.0),
});

// Set Tier Price Schema
const setTierPriceSchema = z.object({
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD'], {
    errorMap: () => ({ message: "Tier must be one of: 'BRONZE', 'SILVER', 'GOLD'" }),
  }),
  price: z.coerce.number().positive('Price must be a positive number'),
  currency: z.string().trim().default('USD'),
});

/**
 * Express middleware generator for Zod schemas
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error.issues || []).map((e) => `${e.path.join('.') || 'field'}: ${e.message}`).join(', ');
      return next(new BadRequestError(`Validation failed: ${issues}`, 'VALIDATION_ERROR'));
    }
    req.body = result.data;
    next();
  };
}

module.exports = {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  setTierPriceSchema,
  validateBody,
};
