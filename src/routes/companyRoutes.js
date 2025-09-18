const express = require('express');
const { body } = require('express-validator');
const {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  bulkOperations,
  getCompanyStatistics,
  addCredits,
  bulkUpdateCompanies,
  bulkDeleteCompanies,
  getCompanyBilling,
  resendCompanyCredentials
} = require('../controllers/companyController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createCompanyValidation = [
  body('companyName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('industry')
    .isIn(['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Consulting', 'Government', 'Non-profit', 'Other'])
    .withMessage('Please select a valid industry'),
  body('size')
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Please select a valid company size'),
  body('contactPerson.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Contact person name is required'),
  body('contactPerson.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Contact person email must be valid')
];

const updateCompanyValidation = [
  body('companyName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('industry')
    .optional()
    .isIn(['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Consulting', 'Government', 'Non-profit', 'Other'])
    .withMessage('Please select a valid industry'),
  body('size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Please select a valid company size'),
  body('subscriptionPlan')
    .optional()
    .isIn(['basic', 'standard', 'premium', 'enterprise'])
    .withMessage('Please select a valid subscription plan'),
  body('subscriptionStatus')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'trial'])
    .withMessage('Please select a valid subscription status'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Please select a valid status')
];

const bulkOperationValidation = [
  body('action')
    .isIn(['activate', 'deactivate', 'suspend'])
    .withMessage('Please provide a valid action'),
  body('companyIds')
    .isArray({ min: 1 })
    .withMessage('Please provide at least one company ID'),
  body('companyIds.*')
    .isMongoId()
    .withMessage('Please provide valid company IDs')
];

const addCreditsValidation = [
  body('credits')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Credits must be between 1 and 10000'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];

// Routes with individual middleware application
router.get('/', protect, authorize('super_admin'), getCompanies);
router.get('/statistics', protect, authorize('super_admin'), getCompanyStatistics);
router.get('/:id', protect, authorize('super_admin'), getCompanyById);
router.post('/', protect, authorize('super_admin'), createCompanyValidation, createCompany);
router.put('/:id', protect, authorize('super_admin'), updateCompanyValidation, updateCompany);
router.delete('/:id', protect, authorize('super_admin'), deleteCompany);
router.post('/bulk', protect, authorize('super_admin'), bulkOperationValidation, bulkOperations);
router.post('/:id/credits', protect, authorize('super_admin'), addCreditsValidation, addCredits);
router.post('/bulk-update', protect, authorize('super_admin'), bulkUpdateCompanies);
router.delete('/bulk-delete', protect, authorize('super_admin'), bulkDeleteCompanies);
router.get('/:id/billing', protect, authorize('super_admin'), getCompanyBilling);
router.post('/:id/resend-credentials', protect, authorize('super_admin'), resendCompanyCredentials);

module.exports = router;
