const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Authentication Middleware
 * Validates the JWT Bearer token from the Authorization header
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access denied. No authentication token provided.'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Authentication token has expired.'));
    }
    return next(new UnauthorizedError('Invalid authentication token.'));
  }
}

/**
 * Role-based authorization middleware
 * Usage: requireRole('SALES_MANAGER', 'FINANCE', 'ADMIN')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action.'));
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
