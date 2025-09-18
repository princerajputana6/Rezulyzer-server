const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Interview title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: [true, 'Candidate ID is required'],
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required'],
  },
  interviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Interviewer ID is required'],
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required'],
    validate: {
      validator: function(date) {
        return date > new Date();
      },
      message: 'Scheduled date must be in the future'
    }
  },
  duration: {
    type: Number, // Duration in minutes
    required: [true, 'Duration is required'],
    min: [15, 'Duration must be at least 15 minutes'],
    max: [480, 'Duration cannot exceed 8 hours'],
    default: 60,
  },
  type: {
    type: String,
    enum: ['technical', 'behavioral', 'hr', 'final', 'phone', 'video', 'onsite'],
    required: [true, 'Interview type is required'],
    default: 'technical',
  },
  mode: {
    type: String,
    enum: ['online', 'offline', 'phone'],
    required: [true, 'Interview mode is required'],
    default: 'online',
  },
  meetingLink: {
    type: String,
    trim: true,
    validate: {
      validator: function(link) {
        if (!link) return true; // Optional field
        const urlRegex = /^https?:\/\/.+/;
        return urlRegex.test(link);
      },
      message: 'Meeting link must be a valid URL'
    }
  },
  location: {
    type: String,
    trim: true,
    maxlength: [500, 'Location cannot exceed 500 characters'],
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'rescheduled', 'no-show'],
    default: 'scheduled',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  // Interview feedback and results
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 10,
    },
    technicalSkills: {
      type: Number,
      min: 1,
      max: 10,
    },
    communication: {
      type: Number,
      min: 1,
      max: 10,
    },
    problemSolving: {
      type: Number,
      min: 1,
      max: 10,
    },
    culturalFit: {
      type: Number,
      min: 1,
      max: 10,
    },
    notes: {
      type: String,
      maxlength: [2000, 'Feedback notes cannot exceed 2000 characters'],
    },
    recommendation: {
      type: String,
      enum: ['hire', 'no-hire', 'maybe', 'pending'],
    },
    strengths: [String],
    weaknesses: [String],
  },
  // Preparation materials
  preparation: {
    topics: [String],
    materials: [String],
    requirements: [String],
  },
  // Reminders and notifications
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push'],
      default: 'email',
    },
    timing: {
      type: Number, // Minutes before interview
      default: 60,
    },
    sent: {
      type: Boolean,
      default: false,
    },
    sentAt: Date,
  }],
  // Attendees (for panel interviews)
  attendees: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    role: {
      type: String,
      enum: ['interviewer', 'observer', 'coordinator'],
      default: 'interviewer',
    },
    confirmed: {
      type: Boolean,
      default: false,
    },
  }],
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Related test results (if applicable)
  relatedTestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
  },
  relatedTestResultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestResult',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
interviewSchema.index({ companyId: 1, scheduledDate: 1 });
interviewSchema.index({ candidateId: 1 });
interviewSchema.index({ interviewerId: 1 });
interviewSchema.index({ status: 1 });
interviewSchema.index({ scheduledDate: 1 });
interviewSchema.index({ createdAt: -1 });

// Virtual for interview duration in hours
interviewSchema.virtual('durationHours').get(function() {
  return Math.round((this.duration / 60) * 100) / 100;
});

// Virtual for time until interview
interviewSchema.virtual('timeUntilInterview').get(function() {
  const now = new Date();
  const timeDiff = this.scheduledDate - now;
  return Math.max(0, Math.floor(timeDiff / (1000 * 60))); // Minutes until interview
});

// Virtual for overall feedback score
interviewSchema.virtual('overallScore').get(function() {
  if (!this.feedback || !this.feedback.rating) return null;
  
  const scores = [
    this.feedback.technicalSkills,
    this.feedback.communication,
    this.feedback.problemSolving,
    this.feedback.culturalFit
  ].filter(score => score != null);
  
  if (scores.length === 0) return this.feedback.rating;
  
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average * 100) / 100;
});

// Static method to find upcoming interviews
interviewSchema.statics.findUpcoming = function(companyId = null, days = 7) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  const query = {
    scheduledDate: { $gte: now, $lte: futureDate },
    status: { $in: ['scheduled', 'in-progress'] }
  };
  
  if (companyId) {
    query.companyId = companyId;
  }
  
  return this.find(query).sort({ scheduledDate: 1 });
};

// Static method to find interviews by date range
interviewSchema.statics.findByDateRange = function(startDate, endDate, companyId = null) {
  const query = {
    scheduledDate: { $gte: startDate, $lte: endDate }
  };
  
  if (companyId) {
    query.companyId = companyId;
  }
  
  return this.find(query).sort({ scheduledDate: 1 });
};

// Static method to get interview statistics
interviewSchema.statics.getStats = function(companyId = null, startDate = null, endDate = null) {
  const matchStage = {};
  
  if (companyId) {
    matchStage.companyId = mongoose.Types.ObjectId(companyId);
  }
  
  if (startDate && endDate) {
    matchStage.scheduledDate = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalInterviews: { $sum: 1 },
        scheduledCount: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
        completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        avgDuration: { $avg: '$duration' },
        avgRating: { $avg: '$feedback.rating' }
      }
    }
  ]);
};

// Instance method to mark as completed
interviewSchema.methods.markCompleted = function(feedback = {}) {
  this.status = 'completed';
  this.updatedBy = feedback.updatedBy;
  
  if (Object.keys(feedback).length > 0) {
    this.feedback = { ...this.feedback, ...feedback };
  }
  
  return this.save();
};

// Instance method to reschedule
interviewSchema.methods.reschedule = function(newDate, updatedBy) {
  this.scheduledDate = newDate;
  this.status = 'rescheduled';
  this.updatedBy = updatedBy;
  
  // Reset reminders
  this.reminders.forEach(reminder => {
    reminder.sent = false;
    reminder.sentAt = undefined;
  });
  
  return this.save();
};

// Instance method to cancel
interviewSchema.methods.cancel = function(updatedBy, reason = '') {
  this.status = 'cancelled';
  this.updatedBy = updatedBy;
  
  if (reason) {
    this.description = (this.description || '') + `\n\nCancellation reason: ${reason}`;
  }
  
  return this.save();
};

// Pre-save middleware to validate scheduling conflicts
interviewSchema.pre('save', async function(next) {
  if (this.isModified('scheduledDate') || this.isModified('interviewerId')) {
    try {
      // Check for interviewer conflicts
      const conflictingInterview = await this.constructor.findOne({
        _id: { $ne: this._id },
        interviewerId: this.interviewerId,
        scheduledDate: {
          $gte: new Date(this.scheduledDate.getTime() - (this.duration * 60000)),
          $lte: new Date(this.scheduledDate.getTime() + (this.duration * 60000))
        },
        status: { $in: ['scheduled', 'in-progress'] }
      });
      
      if (conflictingInterview) {
        const error = new Error('Interviewer has a conflicting interview at this time');
        error.name = 'ValidationError';
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Interview', interviewSchema);
