const prisma = require('../../config/db');
const { NotFoundError, BadRequestError } = require('../../utils/errors');

class ApprovalChainService {
  /**
   * Check if a [min, max] range overlaps with any other rule in the database
   * @param {number} min
   * @param {number} max
   * @param {string|null} excludeId - Rule ID to exclude (for updates)
   */
  async checkRangeOverlap(min, max, excludeId = null) {
    const existingRules = await prisma.approvalChainRule.findMany({
      where: excludeId ? { id: { not: excludeId } } : {},
    });

    for (const rule of existingRules) {
      const ruleMin = Number(rule.minDiscountPercent);
      const ruleMax = Number(rule.maxDiscountPercent);

      // Overlap occurs for closed intervals [min, max] and [ruleMin, ruleMax]
      // if Math.max(min, ruleMin) <= Math.min(max, ruleMax)
      const overlapStart = Math.max(min, ruleMin);
      const overlapEnd = Math.min(max, ruleMax);

      if (overlapStart <= overlapEnd) {
        throw new BadRequestError(
          `Discount range [${min}%, ${max}%] overlaps with existing rule [${ruleMin}%, ${ruleMax}%]. Approval chain ranges must not overlap.`,
          'RANGE_OVERLAP'
        );
      }
    }
  }

  /**
   * List all rules ordered by minDiscountPercent ascending
   */
  async listRules() {
    return prisma.approvalChainRule.findMany({
      orderBy: { minDiscountPercent: 'asc' },
    });
  }

  /**
   * Get a single rule by ID
   */
  async getRuleById(id) {
    const rule = await prisma.approvalChainRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundError(`Approval chain rule with ID '${id}' not found`);
    }

    return rule;
  }

  /**
   * Create a new approval chain rule
   */
  async createRule({
    minDiscountPercent,
    maxDiscountPercent,
    requiresManagerApproval,
    requiresFinanceApproval,
  }) {
    // Validate non-overlapping range
    await this.checkRangeOverlap(minDiscountPercent, maxDiscountPercent);

    return prisma.approvalChainRule.create({
      data: {
        minDiscountPercent,
        maxDiscountPercent,
        requiresManagerApproval: Boolean(requiresManagerApproval),
        requiresFinanceApproval: Boolean(requiresFinanceApproval),
      },
    });
  }

  /**
   * Update an existing approval chain rule
   */
  async updateRule(id, updateData) {
    const existing = await this.getRuleById(id);

    const min =
      updateData.minDiscountPercent !== undefined
        ? Number(updateData.minDiscountPercent)
        : Number(existing.minDiscountPercent);

    const max =
      updateData.maxDiscountPercent !== undefined
        ? Number(updateData.maxDiscountPercent)
        : Number(existing.maxDiscountPercent);

    if (min > max) {
      throw new BadRequestError(
        `minDiscountPercent (${min}%) cannot exceed maxDiscountPercent (${max}%)`
      );
    }

    // Check overlap excluding this rule
    await this.checkRangeOverlap(min, max, id);

    const dataToUpdate = {};
    if (updateData.minDiscountPercent !== undefined) {
      dataToUpdate.minDiscountPercent = min;
    }
    if (updateData.maxDiscountPercent !== undefined) {
      dataToUpdate.maxDiscountPercent = max;
    }
    if (updateData.requiresManagerApproval !== undefined) {
      dataToUpdate.requiresManagerApproval = Boolean(updateData.requiresManagerApproval);
    }
    if (updateData.requiresFinanceApproval !== undefined) {
      dataToUpdate.requiresFinanceApproval = Boolean(updateData.requiresFinanceApproval);
    }

    return prisma.approvalChainRule.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  /**
   * Delete an approval chain rule
   */
  async deleteRule(id) {
    await this.getRuleById(id);
    await prisma.approvalChainRule.delete({
      where: { id },
    });
    return { id, deleted: true };
  }

  /**
   * Resolve which approvals are required for a given discount percentage
   * @param {number} discountPercent
   */
  async resolveRule(discountPercent) {
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw new BadRequestError('discountPercent must be a valid number between 0 and 100');
    }

    const rule = await prisma.approvalChainRule.findFirst({
      where: {
        minDiscountPercent: { lte: discountPercent },
        maxDiscountPercent: { gte: discountPercent },
      },
    });

    if (!rule) {
      throw new NotFoundError(
        `No approval chain rule found covering discount of ${discountPercent}%. Please configure a rule that includes this range.`
      );
    }

    return {
      discountPercent,
      requiresManagerApproval: rule.requiresManagerApproval,
      requiresFinanceApproval: rule.requiresFinanceApproval,
      matchedRule: {
        id: rule.id,
        minDiscountPercent: Number(rule.minDiscountPercent),
        maxDiscountPercent: Number(rule.maxDiscountPercent),
      },
    };
  }
}

module.exports = new ApprovalChainService();
