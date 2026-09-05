/**
 * Simple Request Logging Middleware
 * Outputs: [YYYY-MM-DDTHH:mm:ss.sssZ] METHOD /path STATUS (duration ms)
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl || req.url} ${statusCode} - ${duration}ms`);
  });

  next();
}

module.exports = requestLogger;
