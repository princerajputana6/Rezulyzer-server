const express = require('express');
const { body, query, param } = require('express-validator');
const testController = require('../controllers/testController');
const { protect } = require('../middleware/auth');
const { requireRole, requireOwnerOrAdmin } = require('../middleware/roleAuth');
const { handleValidationErrors } = require('../middleware/validation');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { uploadResume } = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all tests (with filtering, pagination)
router.get('/',
  apiLimiter,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),
    query('type').optional().isIn(['multiple_choice', 'essay', 'coding', 'mixed']).withMessage('Invalid type'),
    query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search term must be between 1 and 100 characters'),
  ],
  handleValidationErrors,
  testController.getTests
);

// Get test by ID
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
  ],
  handleValidationErrors,
  testController.getTestById
);

// Create new test
router.post('/',
  apiLimiter,
  [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    body('type')
      .isIn(['multiple_choice', 'essay', 'coding', 'mixed'])
      .withMessage('Invalid test type'),
    body('duration')
      .isInt({ min: 1, max: 480 })
      .withMessage('Duration must be between 1 and 480 minutes'),
    body('passingScore')
      .isInt({ min: 0, max: 100 })
      .withMessage('Passing score must be between 0 and 100'),
    body('maxAttempts')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Max attempts must be between 1 and 10'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),
    body('questions')
      .optional()
      .isArray()
      .withMessage('Questions must be an array'),
    body('questions.*.question')
      .optional()
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Question text must be between 10 and 1000 characters'),
    body('questions.*.type')
      .optional()
      .isIn(['multiple_choice', 'essay', 'coding'])
      .withMessage('Invalid question type'),
    body('questions.*.points')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Question points must be between 1 and 100'),
  ],
  handleValidationErrors,
  testController.createTest
);

// Update test
router.put('/:id',
  apiLimiter,
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    body('type')
      .optional()
      .isIn(['multiple_choice', 'essay', 'coding', 'mixed'])
      .withMessage('Invalid test type'),
    body('duration')
      .optional()
      .isInt({ min: 1, max: 480 })
      .withMessage('Duration must be between 1 and 480 minutes'),
    body('passingScore')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Passing score must be between 0 and 100'),
    body('maxAttempts')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Max attempts must be between 1 and 10'),
  ],
  handleValidationErrors,
  testController.updateTest
);

// Delete test
router.delete('/:id',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
  ],
  handleValidationErrors,
  testController.deleteTest
);

// Publish test
router.post('/:id/publish',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
  ],
  handleValidationErrors,
  testController.publishTest
);

// Archive test
router.post('/:id/archive',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
  ],
  handleValidationErrors,
  testController.archiveTest
);

// Duplicate test
router.post('/:id/duplicate',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
  ],
  handleValidationErrors,
  testController.duplicateTest
);

// Start test attempt
router.post('/:id/start',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
  ],
  handleValidationErrors,
  testController.startTestAttempt
);

// Submit answer
router.post('/:id/answer',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    body('attemptId').isMongoId().withMessage('Invalid attempt ID'),
    body('questionId').isMongoId().withMessage('Invalid question ID'),
    body('answer').notEmpty().withMessage('Answer is required'),
  ],
  handleValidationErrors,
  testController.submitAnswer
);

// Submit test
router.post('/:id/submit',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    body('attemptId').isMongoId().withMessage('Invalid attempt ID'),
  ],
  handleValidationErrors,
  testController.submitTest
);

// Record proctoring flags (tab switch, fullscreen exit, copy/paste) and optionally auto-submit
router.post('/:id/flag',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    body('attemptId').isMongoId().withMessage('Invalid attempt ID'),
    body('type').isIn(['tab_switch', 'fullscreen_exit', 'copy_paste']).withMessage('Invalid proctor event type'),
  ],
  handleValidationErrors,
  testController.flagProctorEvent
);

// Get test results
router.get('/:id/results',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    query('attemptId').optional().isMongoId().withMessage('Invalid attempt ID'),
  ],
  handleValidationErrors,
  testController.getTestResults
);

// Export proctoring events (CSV or PDF)
router.get('/:id/proctoring/export',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    query('attemptId').isMongoId().withMessage('Invalid attempt ID'),
    query('format').optional().isIn(['csv', 'pdf']).withMessage('Invalid format')
  ],
  handleValidationErrors,
  testController.exportProctoringEvents
);

// Get test attempts
router.get('/:id/attempts',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  handleValidationErrors,
  testController.getTestAttempts
);

// Get test analytics (admin only)
router.get('/:id/analytics',
  requireRole('admin'),
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
  ],
  handleValidationErrors,
  testController.getTestAnalytics
);

// Generate AI questions
router.post('/:id/generate-questions',
  uploadLimiter,
  uploadResume,
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
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
  ],
  handleValidationErrors,
  testController.generateAIQuestions
);

// Send test invitations
router.post('/:id/invite',
  requireOwnerOrAdmin,
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    body('emails')
      .isArray({ min: 1, max: 50 })
      .withMessage('Emails must be an array with 1-50 items'),
    body('emails.*')
      .isEmail()
      .withMessage('Each email must be valid'),
    body('message')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Message must not exceed 500 characters'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expiration date must be valid'),
  ],
  handleValidationErrors,
  testController.sendTestInvitations
);

// Get test invitations
router.get('/:id/invitations',
  requireOwnerOrAdmin,
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  handleValidationErrors,
  testController.getTestInvitations
);

module.exports = router;
