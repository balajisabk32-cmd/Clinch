const discountTierService = require('./service');
const { sendSuccess } = require('../../utils/response');

class DiscountTierController {
  async list(req, res, next) {
    try {
      const tiers = await discountTierService.getDiscountTiers();
      return sendSuccess(res, tiers);
    } catch (error) {
      return next(error);
    }
  }

  async configure(req, res, next) {
    try {
      const result = await discountTierService.setDiscountTier(req.body);
      return sendSuccess(res, result, 201, 'Discount tier ceiling configured successfully');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new DiscountTierController();
