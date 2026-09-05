const approvalChainService = require('./service');
const { sendSuccess } = require('../../utils/response');

class ApprovalChainController {
  async list(req, res, next) {
    try {
      const chains = await approvalChainService.getChains();
      return sendSuccess(res, chains);
    } catch (error) {
      return next(error);
    }
  }

  async configure(req, res, next) {
    try {
      const chain = await approvalChainService.configureChain(req.body);
      return sendSuccess(res, chain, 201, 'Approval chain rule saved successfully');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ApprovalChainController();
