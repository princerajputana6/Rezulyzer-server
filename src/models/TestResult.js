const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPossibleScore: {
    type: Number,
    required: true,
    min: 0,
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  status: {
    type: String,
    enum: ['passed', 'failed'],
    required: true,
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    answer: mongoose.Schema.Types.Mixed, // Can be string, array, or object
    isCorrect: {
      type: Boolean,
      required: true,
    },
    pointsEarned: {
      type: Number,
      required: true,
      min: 0,
    },
    timeSpent: {
      type: Number, // in seconds
      default: 0,
    },
  }],
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  timeTaken: {
    type: Number, // in minutes
    required: true,
  },
  timeRemaining: {
    type: Number, // in minutes
    default: 0,
  },
  submissionType: {
    type: String,
    enum: ['manual', 'auto', 'timeout'],
    default: 'manual',
  },
  browserInfo: {
    userAgent: String,
    platform: String,
    language: String,
  },
  cheatingFlags: [{
    type: {
      type: String,
      enum: ['tab_switch', 'copy_paste', 'right_click', 'fullscreen_exit', 'suspicious_timing'],
    },
    timestamp: Date,
    details: String,
  }],
  proctoring: {
    enabled: {
      type: Boolean,
      default: false,
    },
    screenshots: [String], // URLs to screenshots
    violations: [{
      type: String,
      timestamp: Date,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
      description: String,
    }],
  },
  feedback: {
    candidateFeedback: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    suggestions: String,
  },
  analytics: {
    questionsAttempted: {
      type: Number,
      default: 0,
    },
    questionsSkipped: {
      type: Number,
      default: 0,
    },
    averageTimePerQuestion: {
      type: Number, // in seconds
      default: 0,
    },
    domainWisePerformance: [{
      domain: String,
      questionsAttempted: Number,
      correctAnswers: Number,
      percentage: Number,
    }],
  },
  isReviewed: {
    type: Boolean,
    default: false,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: Date,
  reviewNotes: String,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
testResultSchema.index({ candidateId: 1 });
testResultSchema.index({ testId: 1 });
testResultSchema.index({ companyId: 1 });
testResultSchema.index({ status: 1 });
testResultSchema.index({ percentage: -1 });
testResultSchema.index({ createdAt: -1 });
testResultSchema.index({ startTime: 1 });

// Virtual for grade
testResultSchema.virtual('grade').get(function() {
  if (this.percentage >= 90) return 'A+';
  if (this.percentage >= 80) return 'A';
  if (this.percentage >= 70) return 'B';
  if (this.percentage >= 60) return 'C';
  if (this.percentage >= 50) return 'D';
  return 'F';
});

// Virtual for cheating risk level
testResultSchema.virtual('cheatingRiskLevel').get(function() {
  const flagCount = this.cheatingFlags.length;
  const violationCount = this.proctoring.violations.length;
  const totalRiskFactors = flagCount + violationCount;
  
  if (totalRiskFactors >= 5) return 'high';
  if (totalRiskFactors >= 3) return 'medium';
  if (totalRiskFactors >= 1) return 'low';
  return 'none';
});

// Pre-save middleware to calculate analytics
testResultSchema.pre('save', function(next) {
  if (this.isModified('answers')) {
    // Calculate basic analytics
    this.analytics.questionsAttempted = this.answers.filter(a => a.answer !== null && a.answer !== undefined).length;
    this.analytics.questionsSkipped = this.answers.length - this.analytics.questionsAttempted;
    
    if (this.analytics.questionsAttempted > 0) {
      const totalTime = this.answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
      this.analytics.averageTimePerQuestion = Math.round(totalTime / this.analytics.questionsAttempted);
    }
  }
  
  next();
});

// Instance method to add cheating flag
testResultSchema.methods.addCheatingFlag = function(type, details = '') {
  this.cheatingFlags.push({
    type,
    timestamp: new Date(),
    details,
  });
  return this.save();
};

// Instance method to add proctoring violation
testResultSchema.methods.addProctoringViolation = function(type, severity, description) {
  if (!this.proctoring.enabled) {
    throw new Error('Proctoring is not enabled for this test');
  }
  
  this.proctoring.violations.push({
    type,
    timestamp: new Date(),
    severity,
    description,
  });
  return this.save();
};

// Static method to get results by company
testResultSchema.statics.findByCompany = function(companyId, conditions = {}) {
  return this.find({ ...conditions, companyId });
};

// Static method to get results by test
testResultSchema.statics.findByTest = function(testId, conditions = {}) {
  return this.find({ ...conditions, testId });
};

// Static method to get analytics for a test
testResultSchema.statics.getTestAnalytics = function(testId) {
  return this.aggregate([
    { $match: { testId: new mongoose.Types.ObjectId(testId) } },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        averageScore: { $avg: '$percentage' },
        passCount: {
          $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] }
        },
        failCount: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        averageTimeTaken: { $avg: '$timeTaken' },
        highestScore: { $max: '$percentage' },
        lowestScore: { $min: '$percentage' },
      }
    },
    {
      $addFields: {
        passRate: {
          $multiply: [
            { $divide: ['$passCount', '$totalAttempts'] },
            100
          ]
        }
      }
    }
  ]);
};

// Static method to get company analytics
testResultSchema.statics.getCompanyAnalytics = function(companyId, startDate, endDate) {
  const match = { companyId: new mongoose.Types.ObjectId(companyId) };
  
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTests: { $sum: 1 },
        averageScore: { $avg: '$percentage' },
        passCount: {
          $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] }
        },
        totalCandidates: { $addToSet: '$candidateId' },
      }
    },
    {
      $addFields: {
        uniqueCandidates: { $size: '$totalCandidates' },
        passRate: {
          $multiply: [
            { $divide: ['$passCount', '$totalTests'] },
            100
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model('TestResult', testResultSchema);
