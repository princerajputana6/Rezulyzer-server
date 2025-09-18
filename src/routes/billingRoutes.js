const express = require('express');
const { body } = require('express-validator');
const {
  getBillingRecords,
  getBillingById,
  createBilling,
  updateBilling,
  markAsPaid,
  getBillingStatistics,
  getCompanyBilling,
  generateInvoicePDF,
  sendPaymentReminder
} = require('../controllers/billingController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createBillingValidation = [
  body('companyId')
    .isMongoId()
    .withMessage('Valid company ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('planName')
    .isIn(['basic', 'standard', 'premium', 'enterprise'])
    .withMessage('Please select a valid plan'),
  body('dueDate')
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('billingPeriod.startDate')
    .isISO8601()
    .withMessage('Valid billing period start date is required'),
  body('billingPeriod.endDate')
    .isISO8601()
    .withMessage('Valid billing period end date is required')
];

const updateBillingValidation = [
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('planName')
    .optional()
    .isIn(['basic', 'standard', 'premium', 'enterprise'])
    .withMessage('Please select a valid plan'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Valid due date is required')
];

const markAsPaidValidation = [
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required')
];

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(authorize('super-admin'), getBillingRecords)
  .post(authorize('super-admin'), createBillingValidation, createBilling);

router.route('/statistics')
  .get(authorize('super-admin'), getBillingStatistics);

router.route('/company/:companyId')
  .get(authorize('super-admin', 'admin'), getCompanyBilling);

router.route('/:id')
  .get(authorize('super-admin', 'admin'), getBillingById)
  .put(authorize('super-admin'), updateBillingValidation, updateBilling);

router.route('/:id/pay')
  .post(authorize('super-admin'), markAsPaidValidation, markAsPaid);

router.route('/:id/pdf')
  .get(authorize('super-admin', 'admin'), generateInvoicePDF);

router.route('/:id/reminder')
  .post(authorize('super-admin'), sendPaymentReminder);

module.exports = router;
