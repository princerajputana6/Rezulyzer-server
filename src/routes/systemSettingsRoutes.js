const express = require('express');
const { body } = require('express-validator');
const {
  getSettings,
  getSettingByKey,
  createSetting,
  updateSetting,
  deleteSetting,
  bulkUpdateSettings,
  resetToDefault,
  getSettingsByCategory,
  getCategories
} = require('../controllers/systemSettingsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createSettingValidation = [
  body('key')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Key must be alphanumeric with dots, dashes, or underscores only'),
  body('value')
    .notEmpty()
    .withMessage('Value is required'),
  body('category')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category is required and must be less than 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('dataType')
    .optional()
    .isIn(['string', 'number', 'boolean', 'json', 'array'])
    .withMessage('Data type must be string, number, boolean, json, or array')
];

const updateSettingValidation = [
  body('value')
    .optional()
    .notEmpty()
    .withMessage('Value cannot be empty'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
];

const bulkUpdateValidation = [
  body('settings')
    .isArray({ min: 1 })
    .withMessage('Settings array is required and must contain at least one setting'),
  body('settings.*.key')
    .trim()
    .notEmpty()
    .withMessage('Each setting must have a key'),
  body('settings.*.value')
    .notEmpty()
    .withMessage('Each setting must have a value')
];

// Apply authentication and authorization to all routes
router.use(protect);
router.use(authorize('super_admin'));

// Routes
router.route('/')
  .get(getSettings)
  .post(createSettingValidation, createSetting);

router.route('/categories')
  .get(getCategories);

router.route('/bulk')
  .patch(bulkUpdateValidation, bulkUpdateSettings);

router.route('/category/:category')
  .get(getSettingsByCategory);

router.route('/:key')
  .get(getSettingByKey)
  .put(updateSettingValidation, updateSetting)
  .delete(deleteSetting);

router.route('/:key/reset')
  .post(resetToDefault);

module.exports = router;
