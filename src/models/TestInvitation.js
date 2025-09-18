const mongoose = require('mongoose');

const testInvitationSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  firstName: String,
  lastName: String,
  invitationCode: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'completed', 'expired'],
    default: 'pending',
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  acceptedAt: Date,
  completedAt: Date,
  expiresAt: {
    type: Date,
    required: true,
  },
  message: String,
  customInstructions: String,
  attempts: {
    type: Number,
    default: 1,
    min: 1,
    max: 3,
  },
  usedAttempts: {
    type: Number,
    default: 0,
  },
  settings: {
    allowRetake: {
      type: Boolean,
      default: false,
    },
    showResults: {
      type: Boolean,
      default: true,
    },
    sendResultsEmail: {
      type: Boolean,
      default: true,
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for full name
testInvitationSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.email;
});

// Virtual for is expired
testInvitationSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Virtual for remaining attempts
testInvitationSchema.virtual('remainingAttempts').get(function() {
  return Math.max(0, this.attempts - this.usedAttempts);
});

// Indexes for performance
testInvitationSchema.index({ testId: 1 });
testInvitationSchema.index({ email: 1 });
testInvitationSchema.index({ invitationCode: 1 });
testInvitationSchema.index({ status: 1 });
testInvitationSchema.index({ expiresAt: 1 });

// Static method to find by code
testInvitationSchema.statics.findByCode = function(code) {
  return this.findOne({ invitationCode: code });
};

// Static method to find active invitations
testInvitationSchema.statics.findActive = function(conditions = {}) {
  return this.find({
    ...conditions,
    status: { $in: ['pending', 'accepted'] },
    expiresAt: { $gt: new Date() },
  });
};

// Instance method to accept invitation
testInvitationSchema.methods.accept = function() {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  return this.save();
};

// Instance method to complete invitation
testInvitationSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.usedAttempts += 1;
  return this.save();
};

// Instance method to expire invitation
testInvitationSchema.methods.expire = function() {
  this.status = 'expired';
  return this.save();
};

module.exports = mongoose.model('TestInvitation', testInvitationSchema);
