const express = require('express');
const { body } = require('express-validator');
const {
  getQuestions,
  getQuestionsByDomain,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
  getQuestionAnalytics
} = require('../controllers/questionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createQuestionValidation = [
  body('question')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Question must be between 10 and 2000 characters'),
  body('type')
    .isIn(['multiple-choice', 'coding', 'essay', 'true-false'])
    .withMessage('Please select a valid question type'),
  body('domain')
    .notEmpty()
    .withMessage('Domain is required'),
  body('difficulty')
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Please select a valid difficulty level'),
  body('points')
    .isInt({ min: 1, max: 100 })
    .withMessage('Points must be between 1 and 100'),
  body('options')
    .optional()
    .isArray({ min: 2 })
    .withMessage('Multiple choice questions must have at least 2 options'),
  body('correctAnswer')
    .notEmpty()
    .withMessage('Correct answer is required'),
  body('explanation')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Explanation cannot exceed 1000 characters')
];

const updateQuestionValidation = [
  body('question')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Question must be between 10 and 2000 characters'),
  body('type')
    .optional()
    .isIn(['multiple-choice', 'coding', 'essay', 'true-false'])
    .withMessage('Please select a valid question type'),
  body('domain')
    .optional()
    .notEmpty()
    .withMessage('Domain cannot be empty'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Please select a valid difficulty level'),
  body('points')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Points must be between 1 and 100'),
  body('explanation')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Explanation cannot exceed 1000 characters')
];

const bulkImportValidation = [
  body('questions')
    .isArray({ min: 1 })
    .withMessage('Questions array is required and must contain at least one question')
];

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(getQuestions)
  .post(authorize('super-admin', 'admin'), createQuestionValidation, createQuestion);

router.route('/domains')
  .get(getQuestionsByDomain);

router.route('/analytics')
  .get(getQuestionAnalytics);

router.route('/bulk-import')
  .post(authorize('super-admin', 'admin'), bulkImportValidation, bulkImportQuestions);

router.route('/:id')
  .get(getQuestionById)
  .put(authorize('super-admin', 'admin'), updateQuestionValidation, updateQuestion)
  .delete(authorize('super-admin', 'admin'), deleteQuestion);

module.exports = router;
