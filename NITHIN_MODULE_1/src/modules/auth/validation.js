const { z } = require('zod');
const { BadRequestError } = require('../../utils/errors');

// Internal Staff Signup Schema
const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['REP', 'MANAGER', 'FINANCE', 'ADMIN'], {
    errorMap: () => ({ message: "Role must be one of: 'REP', 'MANAGER', 'FINANCE', 'ADMIN'" }),
  }),
});

// Internal Staff Login Schema
const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Customer Request Magic Link Schema
const requestMagicLinkSchema = z.object({
  email: z.string().trim().email('Invalid customer email address'),
});

// Customer Verify Magic Link Schema
const verifyMagicLinkSchema = z.object({
  token: z.string().trim().min(10, 'A valid magic link token is required'),
});

// Customer Self-Registration Schema
const registerCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  companyName: z.string().trim().min(2, 'Company name must be at least 2 characters'),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD'], {
    errorMap: () => ({ message: "Tier must be one of: 'BRONZE', 'SILVER', 'GOLD'" }),
  }),
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
  signupSchema,
  loginSchema,
  requestMagicLinkSchema,
  verifyMagicLinkSchema,
  registerCustomerSchema,
  validateBody,
};
