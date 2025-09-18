const { HTTP_STATUS, ERROR_MESSAGES } = require('../utils/constants');
const { formatResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Global error handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error: ${error.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { statusCode: HTTP_STATUS.NOT_FOUND, message };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = { statusCode: HTTP_STATUS.CONFLICT, message };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY, message };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = ERROR_MESSAGES.INVALID_TOKEN;
    error = { statusCode: HTTP_STATUS.UNAUTHORIZED, message };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { statusCode: HTTP_STATUS.UNAUTHORIZED, message };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = ERROR_MESSAGES.FILE_TOO_LARGE;
    error = { statusCode: HTTP_STATUS.BAD_REQUEST, message };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = ERROR_MESSAGES.INVALID_FILE_TYPE;
    error = { statusCode: HTTP_STATUS.BAD_REQUEST, message };
  }

  res.status(error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
    formatResponse(
      false,
      error.message || ERROR_MESSAGES.INTERNAL_ERROR,
      process.env.NODE_ENV === 'development' ? { stack: err.stack } : null
    )
  );
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  res.status(HTTP_STATUS.NOT_FOUND);
  next(error);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
};
