const mongoose = require('mongoose');
const { TEST_TYPES, TEST_STATUS } = require('../utils/constants');

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Test title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  type: {
    type: String,
    required: [true, 'Test type is required'],
    enum: Object.values(TEST_TYPES),
  },
  duration: {
    type: Number,
    required: [true, 'Test duration is required'],
    min: [5, 'Duration must be at least 5 minutes'],
    max: [300, 'Duration cannot exceed 300 minutes'],
  },
  totalQuestions: {
    type: Number,
    default: 0,
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  passingScore: {
    type: Number,
    default: 70,
    min: [0, 'Passing score cannot be negative'],
    max: [100, 'Passing score cannot exceed 100'],
  },
  status: {
    type: String,
    enum: Object.values(TEST_STATUS),
    default: TEST_STATUS.DRAFT,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  }],
  tags: [String],
  category: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'medium',
  },
  instructions: {
    type: String,
    maxlength: [1000, 'Instructions cannot exceed 1000 characters'],
  },
  settings: {
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    showResults: {
      type: Boolean,
      default: true,
    },
    allowReview: {
      type: Boolean,
      default: true,
    },
    preventCheating: {
      type: Boolean,
      default: false,
    },
    timeLimit: {
      type: Boolean,
      default: true,
    },
    autoSubmit: {
      type: Boolean,
      default: true,
    },
  },
  analytics: {
    totalAttempts: {
      type: Number,
      default: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    passRate: {
      type: Number,
      default: 0,
    },
    averageTime: {
      type: Number,
      default: 0,
    },
  },
  publishedAt: Date,
  archivedAt: Date,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for formatted duration
testSchema.virtual('formattedDuration').get(function() {
  if (this.duration < 60) {
    return `${this.duration} minutes`;
  }
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
});

// Virtual for pass rate percentage
testSchema.virtual('passRatePercentage').get(function() {
  return this.analytics.totalAttempts > 0 
    ? Math.round((this.analytics.passRate / this.analytics.totalAttempts) * 100)
    : 0;
});

// Indexes for performance
testSchema.index({ createdBy: 1 });
testSchema.index({ status: 1 });
testSchema.index({ type: 1 });
testSchema.index({ createdAt: -1 });
testSchema.index({ title: 'text', description: 'text' });

// Pre-save middleware to update totalQuestions and totalPoints
testSchema.pre('save', async function(next) {
  if (this.isModified('questions')) {
    await this.populate('questions');
    this.totalQuestions = this.questions.length;
    this.totalPoints = this.questions.reduce((total, question) => total + (question.points || 1), 0);
  }
  next();
});

// Static method to find published tests
testSchema.statics.findPublished = function(conditions = {}) {
  return this.find({ ...conditions, status: TEST_STATUS.PUBLISHED });
};

// Static method to find by creator
testSchema.statics.findByCreator = function(userId, conditions = {}) {
  return this.find({ ...conditions, createdBy: userId });
};

// Instance method to publish test
testSchema.methods.publish = function() {
  this.status = TEST_STATUS.PUBLISHED;
  this.publishedAt = new Date();
  return this.save();
};

// Instance method to archive test
testSchema.methods.archive = function() {
  this.status = TEST_STATUS.ARCHIVED;
  this.archivedAt = new Date();
  return this.save();
};

// Instance method to update analytics
testSchema.methods.updateAnalytics = async function() {
  const TestAttempt = mongoose.model('TestAttempt');
  
  const attempts = await TestAttempt.find({ testId: this._id, status: 'completed' });
  
  if (attempts.length > 0) {
    const totalScore = attempts.reduce((sum, attempt) => sum + attempt.percentage, 0);
    const passedAttempts = attempts.filter(attempt => attempt.percentage >= this.passingScore).length;
    const totalTime = attempts.reduce((sum, attempt) => sum + (attempt.timeSpent || 0), 0);
    
    this.analytics.totalAttempts = attempts.length;
    this.analytics.averageScore = Math.round(totalScore / attempts.length);
    this.analytics.passRate = passedAttempts;
    this.analytics.averageTime = Math.round(totalTime / attempts.length);
  }
  
  return this.save();
};

module.exports = mongoose.model('Test', testSchema);
