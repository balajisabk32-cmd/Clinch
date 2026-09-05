const { Router } = require('express');
const authController = require('./controller');
const {
  validateBody,
  signupSchema,
  loginSchema,
  requestMagicLinkSchema,
  verifyMagicLinkSchema,
  registerCustomerSchema,
} = require('./validation');
const {
  authenticateInternal,
  authenticateCustomer,
  authorizeRoles,
} = require('../../middleware/auth');
const { sendSuccess } = require('../../utils/response');

const router = Router();

// =============================================================================
// Internal User Auth Endpoints (/api/auth/internal or /api/v1/auth/internal)
// =============================================================================

router.post(
  '/internal/signup',
  validateBody(signupSchema),
  (req, res, next) => authController.signup(req, res, next)
);

router.post(
  '/internal/login',
  validateBody(loginSchema),
  (req, res, next) => authController.login(req, res, next)
);

router.get(
  '/internal/me',
  authenticateInternal,
  (req, res, next) => authController.getMeInternal(req, res, next)
);

// Protected endpoint to demonstrate and verify role authorization guard
router.get(
  '/internal/manager-only',
  authenticateInternal,
  authorizeRoles('MANAGER', 'ADMIN'),
  (req, res) => {
    return sendSuccess(res, {
      message: 'Access granted to manager-only operational zone.',
      user: req.user,
    });
  }
);

// =============================================================================
// Customer Portal Auth Endpoints (/api/auth/customer or /api/v1/auth/customer)
// =============================================================================

// Customer Self-Registration (Public)
router.post(
  '/customer/register',
  validateBody(registerCustomerSchema),
  (req, res, next) => authController.registerCustomer(req, res, next)
);

router.post(
  '/customer/request-magic-link',
  validateBody(requestMagicLinkSchema),
  (req, res, next) => authController.requestMagicLink(req, res, next)
);

router.post(
  '/customer/verify-magic-link',
  validateBody(verifyMagicLinkSchema),
  (req, res, next) => authController.verifyMagicLink(req, res, next)
);

router.get(
  '/customer/me',
  authenticateCustomer,
  (req, res, next) => authController.getMeCustomer(req, res, next)
);

module.exports = router;
