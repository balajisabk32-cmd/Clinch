const prisma = require('../../config/db');

class DiscountTierService {
  async getDiscountTiers() {
    // Skeleton: retrieve discount ceilings per customer tier and category
    return [];
  }

  async setDiscountTier(data) {
    // Skeleton: create or update discount ceiling for customer tier / category
    return { id: 'temp-discount-tier-id', ...data };
  }
}

module.exports = new DiscountTierService();
