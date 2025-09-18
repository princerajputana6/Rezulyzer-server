const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Debug endpoint to check current user info
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name || req.user.companyName,
      isActive: req.user.isActive,
      model: req.user.constructor.modelName
    }
  });
});

module.exports = router;
