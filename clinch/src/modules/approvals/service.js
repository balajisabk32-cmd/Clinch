const prisma = require('../../config/db');

class ApprovalStateMachineService {
  /**
   * Submit a quote for approval routing:
   * 1. Call risk-scoring API (mocked contract: { score, requiresManagerApproval, requiresFinanceApproval, explanation })
   * 2. Evaluate thresholds & determine initial approval state
   * 3. Record audit log
   */
  async submitQuoteForApproval(quoteId, submitterUser) {
    // Skeleton: will be implemented in Approval State Machine phase
    return {
      quoteId,
      status: 'PENDING_MANAGER_APPROVAL',
      riskScore: 78.5,
      requiresManagerApproval: true,
      requiresFinanceApproval: true,
      explanation: 'Discount on setup service exceeds 10% ceiling for Gold tier',
      auditLog: {
        action: 'SUBMITTED',
        actorId: submitterUser?.id || 'system',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Process approval action: APPROVE, REJECT, or REVISE
   */
  async processApprovalAction(quoteId, action, reviewerUser, comments) {
    // Skeleton: transition quote state and log audit trail
    return {
      quoteId,
      action,
      nextStatus: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'REVISION_REQUESTED',
      reviewer: reviewerUser?.id || 'reviewer',
      comments,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get approval audit trail and status for a quote
   */
  async getApprovalHistory(quoteId) {
    return {
      quoteId,
      status: 'DRAFT',
      history: [],
    };
  }
}

module.exports = new ApprovalStateMachineService();
