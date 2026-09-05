const approvalStateMachine = require('./service');
const { sendSuccess } = require('../../utils/response');

class ApprovalController {
  async submit(req, res, next) {
    try {
      const { quoteId } = req.body;
      const result = await approvalStateMachine.submitQuoteForApproval(quoteId, req.user);
      return sendSuccess(res, result, 200, 'Quote submitted for approval routing');
    } catch (error) {
      return next(error);
    }
  }

  async action(req, res, next) {
    try {
      const { id: quoteId } = req.params;
      const { action, comments } = req.body;
      const result = await approvalStateMachine.processApprovalAction(quoteId, action, req.user, comments);
      return sendSuccess(res, result, 200, `Approval action '${action}' recorded`);
    } catch (error) {
      return next(error);
    }
  }

  async getHistory(req, res, next) {
    try {
      const { id: quoteId } = req.params;
      const result = await approvalStateMachine.getApprovalHistory(quoteId);
      return sendSuccess(res, result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ApprovalController();
