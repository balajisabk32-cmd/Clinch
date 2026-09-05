const { sendError } = require('../utils/response');

/**
 * Global Error Handling Middleware
 * Ensures all API errors return: { success: false, error: { message, code } }
 */
function errorHandler(err, req, res, next) {
  // If response already committed, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Known custom AppError
  if (err.isOperational) {
    return sendError(res, err.message, err.code, err.statusCode);
  }

  // JSON syntax errors in request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'Malformed JSON payload', 'INVALID_JSON', 400);
  }

  // Prisma unique constraint violation (P2002)
  if (err.code === 'P2002') {
    const fields = err.meta?.target ? ` (${Array.isArray(err.meta.target) ? err.meta.target.join(', ') : err.meta.target})` : '';
    return sendError(res, `A record with this value already exists${fields}`, 'RECORD_EXISTS', 409);
  }

  // Prisma record not found (P2025)
  if (err.code === 'P2025') {
    return sendError(res, err.meta?.cause || 'Record not found in database', 'NOT_FOUND', 404);
  }

  // Unhandled / Internal Server Errors
  console.error('[Unhandled Server Error]:', err);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error';
  return sendError(res, message, 'INTERNAL_SERVER_ERROR', 500);
}

module.exports = errorHandler;
