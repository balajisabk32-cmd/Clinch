const authService = require('./service');
const { sendSuccess } = require('../../utils/response');

class AuthController {
  // ---------------------------------------------------------------------------
  // Internal Staff Handlers
  // ---------------------------------------------------------------------------

  async signup(req, res, next) {
    try {
      const result = await authService.signupInternal(req.body);
      return sendSuccess(res, result, 201, 'Internal staff member registered successfully');
    } catch (error) {
      return next(error);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.loginInternal(req.body);
      return sendSuccess(res, result, 200, 'Login successful');
    } catch (error) {
      return next(error);
    }
  }

  async getMeInternal(req, res, next) {
    try {
      const profile = await authService.getInternalProfile(req.user.userId);
      return sendSuccess(res, { user: profile });
    } catch (error) {
      return next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Customer Portal Handlers
  // ---------------------------------------------------------------------------

  async registerCustomer(req, res, next) {
    try {
      const customer = await authService.registerCustomer(req.body);
      return sendSuccess(res, { customer }, 201, 'Customer registered successfully');
    } catch (error) {
      return next(error);
    }
  }

  async requestMagicLink(req, res, next) {
    try {
      const result = await authService.requestMagicLink(req.body.email);
      return sendSuccess(res, result, 200, result.message);
    } catch (error) {
      return next(error);
    }
  }

  async verifyMagicLink(req, res, next) {
    try {
      const result = await authService.verifyMagicLink(req.body.token);
      return sendSuccess(res, result, 200, 'Customer authenticated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async getMeCustomer(req, res, next) {
    try {
      const customer = await authService.getCustomerProfile(req.customer.customerId);
      return sendSuccess(res, { customer });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AuthController();
