const prisma = require('../../config/db');
const { NotFoundError, BadRequestError } = require('../../utils/errors');

class PriceListService {
  /**
   * Set or update the tier price for a product (Atomic Upsert)
   */
  async setTierPrice(productId, { tier, price, currency }) {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID '${productId}' not found.`, 'PRODUCT_NOT_FOUND');
    }

    const priceList = await prisma.priceList.upsert({
      where: {
        productId_tier: {
          productId,
          tier,
        },
      },
      update: {
        price,
        currency: currency || 'USD',
      },
      create: {
        productId,
        tier,
        price,
        currency: currency || 'USD',
      },
    });

    return priceList;
  }

  /**
   * Get all tier prices configured for a product
   */
  async getTierPrices(productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID '${productId}' not found.`, 'PRODUCT_NOT_FOUND');
    }

    const prices = await prisma.priceList.findMany({
      where: { productId },
      orderBy: { tier: 'asc' },
    });

    return prices;
  }

  /**
   * Resolve effective price for a product given a customer tier.
   * If a tier price is defined, use it. Otherwise, fall back to product basePrice.
   * Used directly by Quotation Builder and Discount Governance.
   */
  async resolveEffectivePrice(productId, tier) {
    if (!tier || !['BRONZE', 'SILVER', 'GOLD'].includes(tier.toUpperCase())) {
      throw new BadRequestError(
        "A valid tier query parameter ('BRONZE', 'SILVER', 'GOLD') is required.",
        'INVALID_TIER'
      );
    }

    const normalizedTier = tier.toUpperCase();

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID '${productId}' not found.`, 'PRODUCT_NOT_FOUND');
    }

    const tierPriceRecord = await prisma.priceList.findUnique({
      where: {
        productId_tier: {
          productId,
          tier: normalizedTier,
        },
      },
    });

    const isTierCustomized = !!tierPriceRecord;
    const effectivePrice = isTierCustomized ? tierPriceRecord.price : product.basePrice;
    const currency = isTierCustomized ? tierPriceRecord.currency : 'USD';

    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      tier: normalizedTier,
      effectivePrice,
      basePrice: product.basePrice,
      isTierCustomized,
      currency,
    };
  }
}

module.exports = new PriceListService();
