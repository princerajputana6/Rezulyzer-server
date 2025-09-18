const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  settingKey: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  settingValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'general',
      'email',
      'security',
      'billing',
      'testing',
      'notifications',
      'maintenance',
      'api',
      'storage'
    ],
  },
  description: {
    type: String,
    required: true,
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: true,
  },
  isEditable: {
    type: Boolean,
    default: true,
  },
  isVisible: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  validationRules: {
    min: Number,
    max: Number,
    pattern: String,
    required: Boolean,
    enum: [String],
  },
}, {
  timestamps: true,
});

// Indexes
systemSettingsSchema.index({ settingKey: 1 });
systemSettingsSchema.index({ category: 1 });
systemSettingsSchema.index({ updatedAt: -1 });

// Static method to get setting by key
systemSettingsSchema.statics.getSetting = async function(key) {
  const setting = await this.findOne({ settingKey: key });
  return setting ? setting.settingValue : null;
};

// Static method to update setting
systemSettingsSchema.statics.updateSetting = async function(key, value, updatedBy) {
  return await this.findOneAndUpdate(
    { settingKey: key },
    { 
      settingValue: value, 
      updatedBy: updatedBy,
      updatedAt: new Date()
    },
    { new: true, upsert: false }
  );
};

// Static method to get settings by category
systemSettingsSchema.statics.getSettingsByCategory = function(category) {
  return this.find({ category, isVisible: true }).sort({ settingKey: 1 });
};

// Static method to initialize default settings
systemSettingsSchema.statics.initializeDefaults = async function(adminUserId) {
  const defaultSettings = [
    {
      settingKey: 'site_name',
      settingValue: 'AI Test Portal',
      category: 'general',
      description: 'Name of the application',
      dataType: 'string',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'site_description',
      settingValue: 'Comprehensive AI-powered testing platform',
      category: 'general',
      description: 'Description of the application',
      dataType: 'string',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'max_test_duration',
      settingValue: 180,
      category: 'testing',
      description: 'Maximum test duration in minutes',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'default_test_duration',
      settingValue: 60,
      category: 'testing',
      description: 'Default test duration in minutes',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'max_questions_per_test',
      settingValue: 100,
      category: 'testing',
      description: 'Maximum number of questions per test',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'default_passing_score',
      settingValue: 70,
      category: 'testing',
      description: 'Default passing score percentage',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'email_notifications_enabled',
      settingValue: true,
      category: 'email',
      description: 'Enable email notifications',
      dataType: 'boolean',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'smtp_host',
      settingValue: 'smtp.gmail.com',
      category: 'email',
      description: 'SMTP server host',
      dataType: 'string',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'smtp_port',
      settingValue: 587,
      category: 'email',
      description: 'SMTP server port',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'maintenance_mode',
      settingValue: false,
      category: 'maintenance',
      description: 'Enable maintenance mode',
      dataType: 'boolean',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'maintenance_message',
      settingValue: 'System is under maintenance. Please try again later.',
      category: 'maintenance',
      description: 'Maintenance mode message',
      dataType: 'string',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'api_rate_limit',
      settingValue: 100,
      category: 'api',
      description: 'API rate limit per minute',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'max_file_upload_size',
      settingValue: 10,
      category: 'storage',
      description: 'Maximum file upload size in MB',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'session_timeout',
      settingValue: 24,
      category: 'security',
      description: 'Session timeout in hours',
      dataType: 'number',
      updatedBy: adminUserId,
    },
    {
      settingKey: 'password_min_length',
      settingValue: 8,
      category: 'security',
      description: 'Minimum password length',
      dataType: 'number',
      updatedBy: adminUserId,
    },
  ];

  for (const setting of defaultSettings) {
    await this.findOneAndUpdate(
      { settingKey: setting.settingKey },
      setting,
      { upsert: true, new: true }
    );
  }
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
