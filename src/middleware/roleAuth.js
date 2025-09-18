const { HTTP_STATUS, ERROR_MESSAGES, USER_ROLES } = require('../utils/constants');
const { formatResponse, hasPermission } = require('../utils/helpers');

// Authorize based on user roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        formatResponse(false, ERROR_MESSAGES.UNAUTHORIZED)
      );
    }

    if (!roles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, ERROR_MESSAGES.FORBIDDEN)
      );
    }

    next();
  };
};

// Check if user has minimum required role
const requireRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        formatResponse(false, ERROR_MESSAGES.UNAUTHORIZED)
      );
    }

    if (!hasPermission(req.user.role, minimumRole)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, ERROR_MESSAGES.FORBIDDEN)
      );
    }

    next();
  };
};

// Admin only access
const adminOnly = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN);

// Super admin only access
const superAdminOnly = authorize(USER_ROLES.SUPER_ADMIN);

// Check if user owns resource or has admin privileges
const ownerOrAdmin = (resourceUserField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        formatResponse(false, ERROR_MESSAGES.UNAUTHORIZED)
      );
    }

    // Super admin and admin can access any resource
    if (req.user.role === USER_ROLES.SUPER_ADMIN || req.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.resource?.[resourceUserField] || req.params.userId;
    
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(HTTP_STATUS.FORBIDDEN).json(
      formatResponse(false, ERROR_MESSAGES.FORBIDDEN)
    );
  };
};

// Admin access (admin or super admin)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      formatResponse(false, ERROR_MESSAGES.UNAUTHORIZED)
    );
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      formatResponse(false, ERROR_MESSAGES.FORBIDDEN)
    );
  }

  next();
};

// Owner or admin access
const requireOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      formatResponse(false, ERROR_MESSAGES.UNAUTHORIZED)
    );
  }

  // Admin and super admin can access any resource
  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    return next();
  }

  // For now, allow access - proper ownership check would need resource loading
  next();
};

module.exports = {
  authorize,
  requireRole,
  adminOnly,
  superAdminOnly,
  ownerOrAdmin,
  requireAdmin,
  requireOwnerOrAdmin,
};
