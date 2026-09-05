const prisma = require('../../config/db');
const { NotFoundError, BadRequestError } = require('../../utils/errors');

class ProductService {
  // ---------------------------------------------------------------------------
  // Product Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new product in the catalog
   */
  async createProduct({ name, category, basePrice, unit, taxPercent, description }) {
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        category: category.trim(),
        basePrice,
        unit: unit?.trim() || 'piece',
        taxPercent: taxPercent !== undefined ? taxPercent : 0.0,
        description: description?.trim() || null,
      },
      include: {
        variants: true,
        priceLists: true,
      },
    });

    return product;
  }

  /**
   * Retrieve all products with optional category and search filters
   */
  async getAllProducts(filters = {}) {
    const where = {};

    if (filters.category) {
      where.category = {
        equals: filters.category.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.name = {
        contains: filters.search.trim(),
        mode: 'insensitive',
      };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        variants: true,
        priceLists: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return products;
  }

  /**
   * Get a single product by ID with its variants and tier price lists
   */
  async getProductById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        priceLists: true,
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found.`, 'PRODUCT_NOT_FOUND');
    }

    return product;
  }

  /**
   * Update an existing product
   */
  async updateProduct(id, data) {
    // Verify product exists
    await this.getProductById(id);

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.category && { category: data.category.trim() }),
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
        ...(data.unit && { unit: data.unit.trim() }),
        ...(data.taxPercent !== undefined && { taxPercent: data.taxPercent }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
      },
      include: {
        variants: true,
        priceLists: true,
      },
    });

    return updated;
  }

  /**
   * Delete a product (cascading its variants and price lists)
   */
  async deleteProduct(id) {
    // Verify product exists
    await this.getProductById(id);

    await prisma.product.delete({
      where: { id },
    });

    return { id, message: 'Product and associated variants/price lists deleted successfully.' };
  }

  // ---------------------------------------------------------------------------
  // Variant Operations
  // ---------------------------------------------------------------------------

  /**
   * Add a variant to a product
   */
  async addVariant(productId, { attributeName, attributeValue, extraPrice }) {
    // Verify product exists
    await this.getProductById(productId);

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        attributeName: attributeName.trim(),
        attributeValue: attributeValue.trim(),
        extraPrice: extraPrice !== undefined ? extraPrice : 0.0,
      },
    });

    return variant;
  }

  /**
   * List all variants for a product
   */
  async listVariants(productId) {
    // Verify product exists
    await this.getProductById(productId);

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    return variants;
  }

  /**
   * Delete a specific variant
   */
  async deleteVariant(productId, variantId) {
    // Verify product exists
    await this.getProductById(productId);

    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
      },
    });

    if (!variant) {
      throw new NotFoundError(
        `Variant with ID '${variantId}' not found for product '${productId}'.`,
        'VARIANT_NOT_FOUND'
      );
    }

    await prisma.productVariant.delete({
      where: { id: variantId },
    });

    return { variantId, message: 'Product variant deleted successfully.' };
  }
}

module.exports = new ProductService();
