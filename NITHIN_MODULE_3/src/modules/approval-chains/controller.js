const approvalChainService = require('./service');
const { sendSuccess } = require('../../utils/response');
const { BadRequestError } = require('../../utils/errors');

class ApprovalChainController {
  async list(req, res, next) {
    try {
      const rules = await approvalChainService.listRules();
      return sendSuccess(res, rules);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const rule = await approvalChainService.getRuleById(req.params.id);
      return sendSuccess(res, rule);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const rule = await approvalChainService.createRule(req.body);
      return sendSuccess(res, rule, 201, 'Approval chain rule created successfully');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updatedRule = await approvalChainService.updateRule(req.params.id, req.body);
      return sendSuccess(res, updatedRule, 200, 'Approval chain rule updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await approvalChainService.deleteRule(req.params.id);
      return sendSuccess(res, result, 200, 'Approval chain rule deleted successfully');
    } catch (error) {
      return next(error);
    }
  }

  async resolve(req, res, next) {
    try {
      if (req.query.discountPercent === undefined || req.query.discountPercent === '') {
        throw new BadRequestError('Query parameter discountPercent is required (e.g. /resolve?discountPercent=18)');
      }

      const discountPercent = parseFloat(req.query.discountPercent);
      const result = await approvalChainService.resolveRule(discountPercent);
      return sendSuccess(res, result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ApprovalChainController();
