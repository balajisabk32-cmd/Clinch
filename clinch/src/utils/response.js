/**
 * Standard API Success Response Helper
 * Returns: { success: true, data: ..., message?: string }
 */
function sendSuccess(res, data = null, statusCode = 200, message = null) {
  const payload = {
    success: true,
    data,
  };

  if (message) {
    payload.message = message;
  }

  return res.status(statusCode).json(payload);
}

/**
 * Standard API Error Response Helper
 * Returns: { success: false, error: { message, code } }
 */
function sendError(res, message = 'Internal Server Error', code = 'INTERNAL_ERROR', statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
    },
  });
}

module.exports = {
  sendSuccess,
  sendError,
};
