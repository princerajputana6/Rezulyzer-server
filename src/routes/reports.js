const express = require('express');
const { query, param } = require('express-validator');
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const { handleValidationErrors } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get dashboard analytics
router.get('/dashboard',
  apiLimiter,
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Invalid period'),
  ],
  handleValidationErrors,
  reportController.getDashboardAnalytics
);

// Get test analytics
router.get('/test/:id',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Invalid period'),
  ],
  handleValidationErrors,
  reportController.getTestAnalytics
);

// Get user performance report
router.get('/user/:id/performance',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Invalid period'),
  ],
  handleValidationErrors,
  reportController.getUserPerformance
);

// Get system analytics (admin only)
router.get('/system',
  requireAdmin,
  [
    query('period')
      .optional()
      .isIn(['7d', '30d', '90d', '1y'])
      .withMessage('Invalid period'),
  ],
  handleValidationErrors,
  reportController.getSystemAnalytics
);

// Export test results
router.get('/test/:id/export',
  [
    param('id').isMongoId().withMessage('Invalid test ID'),
    query('format')
      .optional()
      .isIn(['csv', 'pdf'])
      .withMessage('Invalid export format'),
  ],
  handleValidationErrors,
  reportController.exportTestResults
);

module.exports = router;
