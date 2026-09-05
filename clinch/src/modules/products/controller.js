const productService = require('./service');
const { sendSuccess } = require('../../utils/response');

class ProductController {
  // ---------------------------------------------------------------------------
  // Product Handlers
  // ---------------------------------------------------------------------------

  async create(req, res, next) {
    try {
      const product = await productService.createProduct(req.body);
      return sendSuccess(res, { product }, 201, 'Product created successfully');
    } catch (error) {
      return next(error);
    }
  }

  async list(req, res, next) {
    try {
      const products = await productService.getAllProducts(req.query);
      return sendSuccess(res, { products, count: products.length });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.id);
      return sendSuccess(res, { product });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      return sendSuccess(res, { product }, 200, 'Product updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await productService.deleteProduct(req.params.id);
      return sendSuccess(res, result, 200, result.message);
    } catch (error) {
      return next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Variant Handlers
  // ---------------------------------------------------------------------------

  async addVariant(req, res, next) {
    try {
      const variant = await productService.addVariant(req.params.productId, req.body);
      return sendSuccess(res, { variant }, 201, 'Product variant added successfully');
    } catch (error) {
      return next(error);
    }
  }

  async listVariants(req, res, next) {
    try {
      const variants = await productService.listVariants(req.params.productId);
      return sendSuccess(res, { variants, count: variants.length });
    } catch (error) {
      return next(error);
    }
  }

  async deleteVariant(req, res, next) {
    try {
      const result = await productService.deleteVariant(req.params.productId, req.params.variantId);
      return sendSuccess(res, result, 200, result.message);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ProductController();
