const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const Candidate = require('../models/Candidate');
const { HTTP_STATUS, ERROR_MESSAGES } = require('../utils/constants');
const { formatResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  return { accessToken, refreshToken };
};

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        formatResponse(false, ERROR_MESSAGES.UNAUTHORIZED)
      );
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Try to find user in User model first, then Company, then Candidate
      let user = await User.findById(decoded.id).select('-password');
      if (!user) user = await Company.findById(decoded.id).select('-password');
      if (!user) user = await Candidate.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json(
          formatResponse(false, ERROR_MESSAGES.USER_NOT_FOUND)
        );
      }

      // Attach role information from token when DB doc lacks a role (e.g., Candidate)
      req.userRole = decoded.role || user.role;
      if (!user.role && decoded.role) {
        user.role = decoded.role;
      }

      // Check if user is active (for regular users)
      if (user.isActive !== undefined && !user.isActive) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json(
          formatResponse(false, 'Account is deactivated')
        );
      }

      // Check if account is locked (for regular users)
      if (user.lockUntil && user.lockUntil > Date.now()) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json(
          formatResponse(false, ERROR_MESSAGES.ACCOUNT_LOCKED)
        );
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json(
          formatResponse(false, 'Access token expired', 'TOKEN_EXPIRED')
        );
      }
      
      logger.error(`Token verification error: ${error.message}`);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        formatResponse(false, ERROR_MESSAGES.INVALID_TOKEN)
      );
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        let user = await User.findById(decoded.id).select('-password');
        
        // If not found in User model, try Company model
        if (!user) {
          user = await Company.findById(decoded.id).select('-password');
        }
        
        if (user && (user.isActive === undefined || user.isActive)) {
          req.user = user;
        }
      } catch (error) {
        // Token invalid, but continue without user
        logger.warn(`Optional auth token invalid: ${error.message}`);
      }
    }

    next();
  } catch (error) {
    logger.error(`Optional auth middleware error: ${error.message}`);
    next();
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        formatResponse(false, 'Access denied. Please login first.')
      );
    }

    if (!roles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied. Insufficient permissions.')
      );
    }

    next();
  };
};

module.exports = {
  protect,
  optionalAuth,
  authorize,
  generateTokens,
};
