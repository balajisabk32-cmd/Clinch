const discountTierService = require('./service');
const { sendSuccess } = require('../../utils/response');

class DiscountTierController {
  // ==========================================
  // Customer Tier Handlers
  // ==========================================

  async upsertTier(req, res, next) {
    try {
      const result = await discountTierService.upsertTierLimit(req.body);
      return sendSuccess(res, result, 200, `Tier discount limit configured for ${result.tier}`);
    } catch (error) {
      return next(error);
    }
  }

  async listTiers(req, res, next) {
    try {
      const tiers = await discountTierService.getTierLimits();
      return sendSuccess(res, tiers);
    } catch (error) {
      return next(error);
    }
  }

  async getTier(req, res, next) {
    try {
      const tierLimit = await discountTierService.getTierLimit(req.params.tier);
      return sendSuccess(res, tierLimit);
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // Category Handlers
  // ==========================================

  async upsertCategory(req, res, next) {
    try {
      const result = await discountTierService.upsertCategoryLimit(req.body);
      return sendSuccess(res, result, 200, `Category discount limit configured for ${result.category}`);
    } catch (error) {
      return next(error);
    }
  }

  async listCategories(req, res, next) {
    try {
      const categories = await discountTierService.getCategoryLimits();
      return sendSuccess(res, categories);
    } catch (error) {
      return next(error);
    }
  }

  async getCategory(req, res, next) {
    try {
      const categoryLimit = await discountTierService.getCategoryLimit(req.params.category);
      return sendSuccess(res, categoryLimit);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new DiscountTierController();
