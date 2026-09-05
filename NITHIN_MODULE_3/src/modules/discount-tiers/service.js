const prisma = require('../../config/db');
const { NotFoundError } = require('../../utils/errors');

class DiscountTierService {
  // ==========================================
  // Customer Tier Discount Limits
  // ==========================================

  /**
   * Upsert a discount ceiling for a customer tier (BRONZE, SILVER, GOLD)
   */
  async upsertTierLimit({ tier, maxDiscountPercent }) {
    const normalizedTier = tier.toUpperCase();
    return prisma.tierDiscountLimit.upsert({
      where: { tier: normalizedTier },
      update: { maxDiscountPercent },
      create: { tier: normalizedTier, maxDiscountPercent },
    });
  }

  /**
   * List all configured customer tier discount limits
   */
  async getTierLimits() {
    return prisma.tierDiscountLimit.findMany({
      orderBy: { tier: 'asc' },
    });
  }

  /**
   * Get discount ceiling for a specific customer tier
   */
  async getTierLimit(tier) {
    const normalizedTier = tier.toUpperCase();
    const limit = await prisma.tierDiscountLimit.findUnique({
      where: { tier: normalizedTier },
    });

    if (!limit) {
      throw new NotFoundError(`Tier discount limit for tier '${tier}' not found`);
    }

    return limit;
  }

  // ==========================================
  // Product Category Discount Limits
  // ==========================================

  /**
   * Upsert a discount ceiling for a product category (e.g. Hardware, Services)
   */
  async upsertCategoryLimit({ category, maxDiscountPercent }) {
    const trimmedCategory = category.trim();
    return prisma.categoryDiscountLimit.upsert({
      where: { category: trimmedCategory },
      update: { maxDiscountPercent },
      create: { category: trimmedCategory, maxDiscountPercent },
    });
  }

  /**
   * List all configured category discount limits
   */
  async getCategoryLimits() {
    return prisma.categoryDiscountLimit.findMany({
      orderBy: { category: 'asc' },
    });
  }

  /**
   * Get discount ceiling for a specific product category
   */
  async getCategoryLimit(category) {
    const trimmedCategory = category.trim();
    const limit = await prisma.categoryDiscountLimit.findFirst({
      where: {
        category: {
          equals: trimmedCategory,
          mode: 'insensitive',
        },
      },
    });

    if (!limit) {
      throw new NotFoundError(`Category discount limit for '${category}' not found`);
    }

    return limit;
  }
}

module.exports = new DiscountTierService();
