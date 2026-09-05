const { z } = require('zod');
const { ValidationError } = require('../../utils/errors');

const createApprovalRuleSchema = z
  .object({
    minDiscountPercent: z.coerce
      .number({ invalid_type_error: 'minDiscountPercent must be a number' })
      .min(0, 'minDiscountPercent must be between 0 and 100')
      .max(100, 'minDiscountPercent must be between 0 and 100'),
    maxDiscountPercent: z.coerce
      .number({ invalid_type_error: 'maxDiscountPercent must be a number' })
      .min(0, 'maxDiscountPercent must be between 0 and 100')
      .max(100, 'maxDiscountPercent must be between 0 and 100'),
    requiresManagerApproval: z.boolean({ invalid_type_error: 'requiresManagerApproval must be a boolean' }).default(false),
    requiresFinanceApproval: z.boolean({ invalid_type_error: 'requiresFinanceApproval must be a boolean' }).default(false),
  })
  .refine((data) => data.minDiscountPercent <= data.maxDiscountPercent, {
    message: 'minDiscountPercent cannot be greater than maxDiscountPercent',
    path: ['minDiscountPercent'],
  });

const updateApprovalRuleSchema = z
  .object({
    minDiscountPercent: z.coerce
      .number({ invalid_type_error: 'minDiscountPercent must be a number' })
      .min(0, 'minDiscountPercent must be between 0 and 100')
      .max(100, 'minDiscountPercent must be between 0 and 100')
      .optional(),
    maxDiscountPercent: z.coerce
      .number({ invalid_type_error: 'maxDiscountPercent must be a number' })
      .min(0, 'maxDiscountPercent must be between 0 and 100')
      .max(100, 'maxDiscountPercent must be between 0 and 100')
      .optional(),
    requiresManagerApproval: z.boolean().optional(),
    requiresFinanceApproval: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.minDiscountPercent !== undefined && data.maxDiscountPercent !== undefined) {
        return data.minDiscountPercent <= data.maxDiscountPercent;
      }
      return true;
    },
    {
      message: 'minDiscountPercent cannot be greater than maxDiscountPercent',
      path: ['minDiscountPercent'],
    }
  );

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
  createApprovalRuleSchema,
  updateApprovalRuleSchema,
  validateBody,
};
