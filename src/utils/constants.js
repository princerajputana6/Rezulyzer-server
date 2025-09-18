// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

// User roles
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user'
};

// Test types
const TEST_TYPES = {
  TECHNICAL: 'technical',
  APTITUDE: 'aptitude',
  BEHAVIORAL: 'behavioral',
  MIXED: 'mixed'
};

// Test status
const TEST_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

// Test attempt status
const ATTEMPT_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  EXPIRED: 'expired'
};

// Question types
const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer',
  ESSAY: 'essay',
  CODING: 'coding'
};

// Question difficulty levels
const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

// File upload constants
const UPLOAD_LIMITS = {
  RESUME: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  }
};

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

// Time constants
const TIME_CONSTANTS = {
  JWT_EXPIRY: '24h',
  REFRESH_TOKEN_EXPIRY: '7d',
  PASSWORD_RESET_EXPIRY: '1h',
  TEST_DEFAULT_DURATION: 60, // minutes
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
};

// Error messages
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  USER_EXISTS: 'User already exists with this email',
  USER_ALREADY_EXISTS: 'User already exists with this email',
  UNAUTHORIZED: 'Access denied. No token provided',
  FORBIDDEN: 'Access denied. Insufficient permissions',
  INVALID_TOKEN: 'Invalid or expired token',
  ACCOUNT_LOCKED: 'Account is temporarily locked due to too many failed login attempts',
  TEST_NOT_FOUND: 'Test not found',
  ATTEMPT_NOT_FOUND: 'Test attempt not found',
  ATTEMPT_ALREADY_EXISTS: 'Test attempt already exists',
  ATTEMPT_EXPIRED: 'Test attempt has expired',
  INVALID_FILE_TYPE: 'Invalid file type',
  FILE_TOO_LARGE: 'File size exceeds limit',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
};

// Success messages
const SUCCESS_MESSAGES = {
  USER_REGISTERED: 'User registered successfully',
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  USER_DELETED: 'User deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_RESET_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',
  TEST_CREATED: 'Test created successfully',
  TEST_UPDATED: 'Test updated successfully',
  TEST_DELETED: 'Test deleted successfully',
  TEST_PUBLISHED: 'Test published successfully',
  ATTEMPT_STARTED: 'Test attempt started',
  ATTEMPT_SUBMITTED: 'Test attempt submitted successfully',
  FILE_UPLOADED: 'File uploaded successfully',
};

// Email subjects
const EMAIL_SUBJECTS = {
  WELCOME: 'Welcome to AI Testing Portal',
  PASSWORD_RESET: 'Password Reset Request',
  TEST_INVITATION: 'Test Invitation',
  TEST_RESULTS: 'Test Results Available',
};

// Combined messages object for easier import
const MESSAGES = {
  SUCCESS: SUCCESS_MESSAGES,
  ERROR: ERROR_MESSAGES
};

module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  TEST_TYPES,
  TEST_STATUS,
  ATTEMPT_STATUS,
  QUESTION_TYPES,
  DIFFICULTY_LEVELS,
  UPLOAD_LIMITS,
  PAGINATION,
  TIME_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  EMAIL_SUBJECTS,
  MESSAGES,
};
