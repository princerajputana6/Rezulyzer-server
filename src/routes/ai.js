const express = require('express');
const { body } = require('express-validator');
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { aiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { uploadResume } = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Generate questions
router.post('/generate-questions',
  aiLimiter,
  uploadResume,
  [
    body('prompt')
      .optional()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Prompt must be between 10 and 500 characters'),
    body('count')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Question count must be between 1 and 20'),
    body('difficulty')
      .optional()
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Invalid difficulty level'),
    body('type')
      .optional()
      .isIn(['multiple_choice', 'essay', 'coding'])
      .withMessage('Invalid question type'),
    body('subject')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Subject must be between 2 and 100 characters'),
  ],
  handleValidationErrors,
  aiController.generateQuestions
);

// Analyze resume
router.post('/analyze-resume',
  aiLimiter,
  uploadResume,
  [
    body('jobDescription')
      .optional()
      .trim()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Job description must be between 10 and 2000 characters'),
  ],
  handleValidationErrors,
  aiController.analyzeResume
);

// Generate test suggestions
router.post('/suggest-tests',
  aiLimiter,
  [
    body('skills')
      .isArray({ min: 1, max: 10 })
      .withMessage('Skills must be an array with 1-10 items'),
    body('skills.*')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Each skill must be between 2 and 50 characters'),
    body('experience')
      .optional()
      .isIn(['entry', 'mid', 'senior'])
      .withMessage('Invalid experience level'),
    body('role')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Role must be between 2 and 100 characters'),
  ],
  handleValidationErrors,
  aiController.suggestTests
);

module.exports = router;
