const express = require('express');
const {
  getDashboardAnalytics,
  getCompanyAnalytics,
  getTestAnalytics,
  getSystemMetrics,
  exportAnalytics,
  getAdminKpis,
  getCompanyKpis
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/dashboard')
  .get(authorize('super-admin'), getDashboardAnalytics);

router.route('/company/:id')
  .get(authorize('super-admin', 'admin'), getCompanyAnalytics);

router.route('/test/:id')
  .get(authorize('super-admin', 'admin'), getTestAnalytics);

router.route('/system')
  .get(authorize('super-admin'), getSystemMetrics);

router.route('/export')
  .get(authorize('super-admin', 'admin'), exportAnalytics);

// KPI endpoints for dashboard cards
router.route('/kpi/admin')
  .get(authorize('super-admin', 'admin'), getAdminKpis);

router.route('/kpi/company')
  .get(authorize('company', 'admin'), getCompanyKpis);

module.exports = router;
