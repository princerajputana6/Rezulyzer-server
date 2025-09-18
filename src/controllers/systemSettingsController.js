const SystemSettings = require('../models/SystemSettings');
const { HTTP_STATUS, ERROR_MESSAGES } = require('../utils/constants');
const { formatResponse } = require('../utils/helpers');
const { validationResult } = require('express-validator');

// @desc    Get all system settings
// @route   GET /api/system-settings
// @access  Private (Super Admin only)
const getSettings = async (req, res) => {
  try {
    const { category, search } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { key: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const settings = await SystemSettings.find(filter).sort({ category: 1, key: 1 });

    // Group settings by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json(formatResponse(true, 'Settings retrieved successfully', {
      settings: groupedSettings,
      total: settings.length
    }));
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Get setting by key
// @route   GET /api/system-settings/:key
// @access  Private (Super Admin only)
const getSettingByKey = async (req, res) => {
  try {
    const setting = await SystemSettings.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Setting not found')
      );
    }

    res.json(formatResponse(true, 'Setting retrieved successfully', { setting }));
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Create new setting
// @route   POST /api/system-settings
// @access  Private (Super Admin only)
const createSetting = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Validation error', { errors: errors.array() })
      );
    }

    const { key, value, category, description, dataType, validation } = req.body;

    // Check if setting already exists
    const existingSetting = await SystemSettings.findOne({ key });
    if (existingSetting) {
      return res.status(HTTP_STATUS.CONFLICT).json(
        formatResponse(false, 'Setting with this key already exists')
      );
    }

    const setting = new SystemSettings({
      key,
      value,
      category,
      description,
      dataType: dataType || 'string',
      validation: validation || {},
      updatedBy: req.user.id
    });

    await setting.save();

    res.status(HTTP_STATUS.CREATED).json(
      formatResponse(true, 'Setting created successfully', { setting })
    );
  } catch (error) {
    console.error('Error creating setting:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Update setting
// @route   PUT /api/system-settings/:key
// @access  Private (Super Admin only)
const updateSetting = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Validation error', { errors: errors.array() })
      );
    }

    const setting = await SystemSettings.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Setting not found')
      );
    }

    const { value, description, validation } = req.body;

    // Validate value based on data type and validation rules
    if (value !== undefined) {
      const validationResult = SystemSettings.validateValue(value, setting.dataType, setting.validation);
      if (!validationResult.isValid) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          formatResponse(false, `Invalid value: ${validationResult.error}`)
        );
      }
    }

    // Update fields
    if (value !== undefined) setting.value = value;
    if (description !== undefined) setting.description = description;
    if (validation !== undefined) setting.validation = validation;
    
    setting.updatedBy = req.user.id;
    setting.updatedAt = new Date();

    await setting.save();

    res.json(formatResponse(true, 'Setting updated successfully', { setting }));
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Delete setting
// @route   DELETE /api/system-settings/:key
// @access  Private (Super Admin only)
const deleteSetting = async (req, res) => {
  try {
    const setting = await SystemSettings.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Setting not found')
      );
    }

    // Check if setting is system critical
    if (setting.isSystemCritical) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Cannot delete system critical setting')
      );
    }

    await SystemSettings.deleteOne({ key: req.params.key });

    res.json(formatResponse(true, 'Setting deleted successfully'));
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Bulk update settings
// @route   PATCH /api/system-settings/bulk
// @access  Private (Super Admin only)
const bulkUpdateSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Settings array is required')
      );
    }

    const updateResults = [];
    const errors = [];

    for (const settingUpdate of settings) {
      try {
        const { key, value } = settingUpdate;
        
        const setting = await SystemSettings.findOne({ key });
        if (!setting) {
          errors.push({ key, error: 'Setting not found' });
          continue;
        }

        // Validate value
        const validationResult = SystemSettings.validateValue(value, setting.dataType, setting.validation);
        if (!validationResult.isValid) {
          errors.push({ key, error: validationResult.error });
          continue;
        }

        setting.value = value;
        setting.updatedBy = req.user.id;
        setting.updatedAt = new Date();
        
        await setting.save();
        updateResults.push({ key, success: true });
      } catch (error) {
        errors.push({ key: settingUpdate.key, error: error.message });
      }
    }

    res.json(formatResponse(true, 'Bulk update completed', {
      updated: updateResults,
      errors: errors,
      totalProcessed: settings.length,
      successCount: updateResults.length,
      errorCount: errors.length
    }));
  } catch (error) {
    console.error('Error bulk updating settings:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Reset setting to default
// @route   POST /api/system-settings/:key/reset
// @access  Private (Super Admin only)
const resetToDefault = async (req, res) => {
  try {
    const setting = await SystemSettings.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Setting not found')
      );
    }

    if (setting.defaultValue === undefined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'No default value defined for this setting')
      );
    }

    setting.value = setting.defaultValue;
    setting.updatedBy = req.user.id;
    setting.updatedAt = new Date();

    await setting.save();

    res.json(formatResponse(true, 'Setting reset to default successfully', { setting }));
  } catch (error) {
    console.error('Error resetting setting:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Get settings by category
// @route   GET /api/system-settings/category/:category
// @access  Private (Super Admin only)
const getSettingsByCategory = async (req, res) => {
  try {
    const settings = await SystemSettings.find({ 
      category: req.params.category 
    }).sort({ key: 1 });

    res.json(formatResponse(true, 'Settings retrieved successfully', {
      settings,
      category: req.params.category,
      total: settings.length
    }));
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Get all categories
// @route   GET /api/system-settings/categories
// @access  Private (Super Admin only)
const getCategories = async (req, res) => {
  try {
    const categories = await SystemSettings.distinct('category');
    
    // Get count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await SystemSettings.countDocuments({ category });
        return { name: category, count };
      })
    );

    res.json(formatResponse(true, 'Categories retrieved successfully', {
      categories: categoriesWithCount,
      total: categories.length
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

module.exports = {
  getSettings,
  getSettingByKey,
  createSetting,
  updateSetting,
  deleteSetting,
  bulkUpdateSettings,
  resetToDefault,
  getSettingsByCategory,
  getCategories
};
