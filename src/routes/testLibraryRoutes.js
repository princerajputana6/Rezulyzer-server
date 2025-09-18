const express = require('express');
const { body } = require('express-validator');
const {
  getTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  updateTestStatus,
  assignQuestions,
  removeQuestions,
  duplicateTest
} = require('../controllers/testLibraryController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createTestValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('type')
    .isIn(['technical', 'aptitude', 'behavioral', 'mixed'])
    .withMessage('Please select a valid test type'),
  body('difficulty')
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Please select a valid difficulty level'),
  body('duration')
    .isInt({ min: 5, max: 300 })
    .withMessage('Duration must be between 5 and 300 minutes'),
  body('passingScore')
    .isInt({ min: 0, max: 100 })
    .withMessage('Passing score must be between 0 and 100'),
  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Instructions cannot exceed 1000 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('questions')
    .optional()
    .isArray()
    .withMessage('Questions must be an array')
];

const updateTestValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('type')
    .optional()
    .isIn(['technical', 'aptitude', 'behavioral', 'mixed'])
    .withMessage('Please select a valid test type'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Please select a valid difficulty level'),
  body('duration')
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage('Duration must be between 5 and 300 minutes'),
  body('passingScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Passing score must be between 0 and 100')
];

const statusValidation = [
  body('status')
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived')
];

const questionAssignmentValidation = [
  body('questionIds')
    .isArray({ min: 1 })
    .withMessage('Question IDs array is required and must contain at least one question')
];

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(authorize('super_admin', 'admin'), getTests)
  .post(authorize('super_admin', 'admin'), createTestValidation, createTest);

router.route('/:id')
  .get(authorize('super_admin', 'admin'), getTestById)
  .put(authorize('super_admin', 'admin'), updateTestValidation, updateTest)
  .delete(authorize('super_admin', 'admin'), deleteTest);

router.route('/:id/status')
  .patch(authorize('super_admin', 'admin'), statusValidation, updateTestStatus);

router.route('/:id/questions')
  .post(authorize('super_admin', 'admin'), questionAssignmentValidation, assignQuestions)
  .delete(authorize('super_admin', 'admin'), questionAssignmentValidation, removeQuestions);

router.route('/:id/duplicate')
  .post(authorize('super_admin', 'admin'), duplicateTest);

module.exports = router;
