const express = require('express');
const { body, query, param } = require('express-validator');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { requireRole, requireAdmin } = require('../middleware/roleAuth');
const { handleValidationErrors } = require('../middleware/validation');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { uploadAvatar } = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all users (admin only)
router.get('/',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('role').optional().isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role'),
    query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search term must be between 1 and 100 characters'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  handleValidationErrors,
  userController.getUsers
);

// Get user by ID
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
  ],
  handleValidationErrors,
  userController.getUserById
);

// Update user profile
router.put('/profile',
  apiLimiter,
  [
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
  handleValidationErrors,
  userController.updateProfile
);

// Upload avatar
router.post('/avatar',
  uploadLimiter,
  uploadAvatar,
  userController.uploadAvatar
);

// Update user (admin only)
router.put('/:id',
  requireAdmin,
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
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
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Invalid role'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],
  handleValidationErrors,
  userController.updateUser
);

// Delete user (admin only)
router.delete('/:id',
  requireAdmin,
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
  ],
  handleValidationErrors,
  userController.deleteUser
);

// Get user statistics (admin only)
router.get('/:id/stats',
  requireAdmin,
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
  ],
  handleValidationErrors,
  userController.getUserStats
);

module.exports = router;
