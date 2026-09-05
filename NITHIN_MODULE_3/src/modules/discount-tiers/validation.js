const { z } = require('zod');
const { ValidationError } = require('../../utils/errors');

const setTierLimitSchema = z.object({
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD'], {
    errorMap: () => ({ message: 'tier must be one of: BRONZE, SILVER, GOLD' }),
  }),
  maxDiscountPercent: z.coerce
    .number({ invalid_type_error: 'maxDiscountPercent must be a number' })
    .min(0, 'maxDiscountPercent must be between 0 and 100')
    .max(100, 'maxDiscountPercent must be between 0 and 100'),
});

const setCategoryLimitSchema = z.object({
  category: z
    .string({ required_error: 'category is required' })
    .trim()
    .min(1, 'category must not be empty'),
  maxDiscountPercent: z.coerce
    .number({ invalid_type_error: 'maxDiscountPercent must be a number' })
    .min(0, 'maxDiscountPercent must be between 0 and 100')
    .max(100, 'maxDiscountPercent must be between 0 and 100'),
});

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error.issues || []).map((e) => `${e.path.join('.') || 'field'}: ${e.message}`).join(', ');
      return next(new ValidationError(`Validation failed: ${issues}`));
    }
    req.body = result.data;
    next();
  };
}


module.exports = {
  setTierLimitSchema,
  setCategoryLimitSchema,
  validateBody,
};
