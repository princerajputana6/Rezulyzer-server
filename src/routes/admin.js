const express = require('express');
const { query, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const { handleValidationErrors } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
const { createSuccessResponse } = require('../utils/helpers');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(requireAdmin);

// Get system stats
router.get('/stats',
  apiLimiter,
  asyncHandler(async (req, res) => {
    res.json(
      createSuccessResponse('Admin stats retrieved successfully', {
        message: 'Admin functionality coming soon'
      })
    );
  })
);

module.exports = router;
