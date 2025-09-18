const express = require('express');
const authRoutes = require('./auth');
const testRoutes = require('./tests');
const userRoutes = require('./users');
const aiRoutes = require('./ai');
const reportRoutes = require('./reports');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Route definitions
router.use('/auth', authRoutes);
router.use('/tests', testRoutes);
router.use('/users', userRoutes);
router.use('/ai', aiRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
