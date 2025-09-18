const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PAGINATION } = require('./constants');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate pagination metadata
const getPaginationMeta = (paginateResult) => {
  if (paginateResult && typeof paginateResult === 'object' && paginateResult.page) {
    return {
      page: paginateResult.page,
      limit: paginateResult.limit,
      total: paginateResult.totalDocs,
      totalPages: paginateResult.totalPages,
      hasNext: paginateResult.hasNextPage,
      hasPrev: paginateResult.hasPrevPage,
    };
  }
  
  // Fallback for manual pagination
  const page = paginateResult?.page || 1;
  const limit = paginateResult?.limit || 10;
  const total = paginateResult?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages,
    hasNext,
    hasPrev,
  };
};

// Parse pagination parameters
const parsePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

// Format API response
const formatResponse = (success, message, data = null, pagination = null) => {
  const response = {
    success,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
};

// Calculate test score
const calculateTestScore = (answers, questions) => {
  let correctAnswers = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  questions.forEach(question => {
    totalPoints += question.points || 1;
    
    const userAnswer = answers.find(a => a.questionId.toString() === question._id.toString());
    
    if (userAnswer && userAnswer.answer === question.correctAnswer) {
      correctAnswers++;
      earnedPoints += question.points || 1;
    }
  });

  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  return {
    correctAnswers,
    totalQuestions: questions.length,
    earnedPoints,
    totalPoints,
    percentage,
  };
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

// Generate test invitation code
const generateInvitationCode = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};

// Check if user has permission
const hasPermission = (userRole, requiredRole) => {
  const roleHierarchy = {
    user: 1,
    admin: 2,
    super_admin: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Format duration in minutes to human readable
const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
};

// Generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate random color for user avatar
const generateAvatarColor = (name) => {
  const colors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];
  
  const hash = name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  return colors[Math.abs(hash) % colors.length];
};

// Deep clone object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Remove sensitive fields from user object
const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  delete userObj.refreshToken;
  delete userObj.__v;
  return userObj;
};

// Generate file path
const generateFilePath = (filename, directory = 'uploads') => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = filename.split('.').pop();
  const baseName = filename.split('.').slice(0, -1).join('.');
  
  return `${directory}/${baseName}-${timestamp}-${randomString}.${extension}`;
};

// Create success response
const createSuccessResponse = (message, data = null, pagination = null) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
};

// Create error response
const createErrorResponse = (message, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
};

module.exports = {
  generateRandomString,
  hashPassword,
  comparePassword,
  getPaginationMeta,
  parsePaginationParams,
  formatResponse,
  createSuccessResponse,
  createErrorResponse,
  calculateTestScore,
  sanitizeInput,
  generateInvitationCode,
  hasPermission,
  formatDuration,
  generateSlug,
  isValidEmail,
  generateAvatarColor,
  deepClone,
  sanitizeUser,
  generateFilePath,
};
