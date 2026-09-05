const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Authenticate Internal Staff (Rep, Manager, Finance, Admin)
 * Verifies JWT and enforces type === 'internal'
 */
function authenticateInternal(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access denied. No authentication token provided.'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    if (decoded.type !== 'internal') {
      return next(new ForbiddenError('Access denied. Internal staff token required.'));
    }

    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Authentication token has expired.', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid authentication token.', 'INVALID_TOKEN'));
  }
}

/**
 * Authenticate Customer Portal Users
 * Verifies JWT and enforces type === 'customer'
 */
function authenticateCustomer(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access denied. No authentication token provided.'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    if (decoded.type !== 'customer') {
      return next(new ForbiddenError('Access denied. Customer portal token required.'));
    }

    req.customer = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Authentication token has expired.', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid authentication token.', 'INVALID_TOKEN'));
  }
}

/**
 * Role-based Authorization Guard
 * Usage: authorizeRoles('MANAGER', 'FINANCE')
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Forbidden. Action requires one of the following roles: ${allowedRoles.join(', ')} (current: ${req.user.role})`
        )
      );
    }

    return next();
  };
}

module.exports = {
  authenticateInternal,
  authenticateCustomer,
  authorizeRoles,
};
