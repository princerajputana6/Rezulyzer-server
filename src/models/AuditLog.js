const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'user_login',
      'company_login',
      'user_logout',
      'user_registered',
      'password_changed',
      'password_reset',
      'password_reset_requested',
      'password_reset_completed',
      'login_failed',
      'profile_updated',
      'test_created',
      'test_updated',
      'test_deleted',
      'test_published',
      'test_archived',
      'test_started',
      'test_submitted',
      'question_created',
      'question_updated',
      'question_deleted',
      'user_created',
      'user_updated',
      'user_deleted',
      'user_activated',
      'user_deactivated',
      'invitation_sent',
      'invitation_accepted',
      'avatar_uploaded',
      'resume_analyzed',
      'ai_questions_generated',
      'test_suggestions_generated',
      'test_results_exported',
      'login_failed',
      'email_verified'
    ],
  },
  resourceType: {
    type: String,
    enum: ['User', 'Test', 'Question', 'TestAttempt', 'TestInvitation', 'File', 'System'],
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  success: {
    type: Boolean,
    default: true,
  },
  errorMessage: String,
  metadata: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
});

// Indexes for performance
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ success: 1 });

// Static method to log action
auditLogSchema.statics.logAction = function(data) {
  return this.create({
    userId: data.userId,
    action: data.action,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    details: data.details,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    success: data.success !== false,
    errorMessage: data.errorMessage,
    metadata: data.metadata,
  });
};

// Static method to find by user
auditLogSchema.statics.findByUser = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email');
};

// Static method to find by action
auditLogSchema.statics.findByAction = function(action, limit = 100) {
  return this.find({ action })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email');
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
