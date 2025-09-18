const { body, param, query, validationResult } = require('express-validator');
const { USER_ROLES, TEST_TYPES, QUESTION_TYPES } = require('./constants');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation error',
      errors: errors.array(),
    });
  }
  next();
};

// User validation rules
const userValidationRules = {
  register: [
    body('firstName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('role')
      .optional()
      .isIn(Object.values(USER_ROLES))
      .withMessage('Invalid user role'),
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],

  updateProfile: [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],

  forgotPassword: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],
};

// Test validation rules
const testValidationRules = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Test title must be between 3 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('type')
      .isIn(Object.values(TEST_TYPES))
      .withMessage('Invalid test type'),
    body('duration')
      .isInt({ min: 5, max: 300 })
      .withMessage('Duration must be between 5 and 300 minutes'),
    body('passingScore')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Passing score must be between 0 and 100'),
    body('questions')
      .optional()
      .isArray()
      .withMessage('Questions must be an array'),
  ],

  update: [
    param('id')
      .isMongoId()
      .withMessage('Invalid test ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Test title must be between 3 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    body('type')
      .optional()
      .isIn(Object.values(TEST_TYPES))
      .withMessage('Invalid test type'),
    body('duration')
      .optional()
      .isInt({ min: 5, max: 300 })
      .withMessage('Duration must be between 5 and 300 minutes'),
    body('passingScore')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Passing score must be between 0 and 100'),
  ],

  getById: [
    param('id')
      .isMongoId()
      .withMessage('Invalid test ID'),
  ],

  delete: [
    param('id')
      .isMongoId()
      .withMessage('Invalid test ID'),
  ],
};

// Question validation rules
const questionValidationRules = {
  create: [
    body('question')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Question must be between 10 and 1000 characters'),
    body('type')
      .isIn(Object.values(QUESTION_TYPES))
      .withMessage('Invalid question type'),
    body('options')
      .if(body('type').equals('multiple_choice'))
      .isArray({ min: 2, max: 6 })
      .withMessage('Multiple choice questions must have 2-6 options'),
    body('correctAnswer')
      .notEmpty()
      .withMessage('Correct answer is required'),
    body('points')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Points must be between 1 and 100'),
    body('explanation')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Explanation must not exceed 500 characters'),
  ],
};

// Test attempt validation rules
const attemptValidationRules = {
  start: [
    param('testId')
      .isMongoId()
      .withMessage('Invalid test ID'),
  ],

  submit: [
    param('testId')
      .isMongoId()
      .withMessage('Invalid test ID'),
    body('answers')
      .isArray()
      .withMessage('Answers must be an array'),
    body('answers.*.questionId')
      .isMongoId()
      .withMessage('Invalid question ID'),
    body('answers.*.answer')
      .notEmpty()
      .withMessage('Answer is required'),
  ],
};

// Query validation rules
const queryValidationRules = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  search: [
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search term must not exceed 100 characters'),
  ],

  filter: [
    query('type')
      .optional()
      .isIn([...Object.values(TEST_TYPES), 'all'])
      .withMessage('Invalid filter type'),
    query('status')
      .optional()
      .isIn(['draft', 'published', 'archived', 'all'])
      .withMessage('Invalid filter status'),
  ],
};

// AI validation rules
const aiValidationRules = {
  generateQuestions: [
    body('resumeText')
      .trim()
      .isLength({ min: 100 })
      .withMessage('Resume text must be at least 100 characters'),
    body('testType')
      .isIn(Object.values(TEST_TYPES))
      .withMessage('Invalid test type'),
    body('questionCount')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Question count must be between 1 and 50'),
  ],

  analyzeResume: [
    body('resumeText')
      .trim()
      .isLength({ min: 100 })
      .withMessage('Resume text must be at least 100 characters'),
  ],
};

module.exports = {
  handleValidationErrors,
  userValidationRules,
  testValidationRules,
  questionValidationRules,
  attemptValidationRules,
  queryValidationRules,
  aiValidationRules,
};
