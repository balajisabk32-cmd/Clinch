const priceListService = require('./service');
const { sendSuccess } = require('../../utils/response');

class PriceListController {
  async setTierPrice(req, res, next) {
    try {
      const priceList = await priceListService.setTierPrice(req.params.productId, req.body);
      return sendSuccess(res, { priceList }, 200, `Tier price for ${priceList.tier} saved successfully`);
    } catch (error) {
      return next(error);
    }
  }

  async getTierPrices(req, res, next) {
    try {
      const prices = await priceListService.getTierPrices(req.params.productId);
      return sendSuccess(res, { prices, count: prices.length });
    } catch (error) {
      return next(error);
    }
  }

  async resolve(req, res, next) {
    try {
      const result = await priceListService.resolveEffectivePrice(req.params.productId, req.query.tier);
      return sendSuccess(res, result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new PriceListController();
