const mongoose = require('mongoose');
const { QUESTION_TYPES, DIFFICULTY_LEVELS } = require('../utils/constants');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [2000, 'Question cannot exceed 2000 characters'],
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'coding', 'essay', 'true-false'],
    required: [true, 'Question type is required'],
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    enum: [
      'JavaScript',
      'Python',
      'Java',
      'C++',
      'C#',
      'PHP',
      'Ruby',
      'Go',
      'Rust',
      'Swift',
      'Kotlin',
      'TypeScript',
      'SQL',
      'NoSQL',
      'MongoDB',
      'PostgreSQL',
      'MySQL',
      'Redis',
      'HTML',
      'CSS',
      'React',
      'Angular',
      'Vue',
      'Node.js',
      'Express',
      'Django',
      'Flask',
      'Spring',
      'Docker',
      'Kubernetes',
      'AWS',
      'Azure',
      'GCP',
      'CI/CD',
      'DevOps',
      'System Design',
      'Architecture',
      'Data Structures',
      'Algorithms',
      'Machine Learning',
      'AI',
      'Data Science',
      'Cybersecurity',
      'Testing',
      'Soft Skills',
      'Aptitude',
      'Communication',
      'Leadership',
      'Problem Solving'
    ],
  },
  subDomain: {
    type: String,
    trim: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: [true, 'Difficulty level is required'],
  },
  points: {
    type: Number,
    required: [true, 'Points are required'],
    min: [1, 'Points must be at least 1'],
    max: [100, 'Points cannot exceed 100'],
  },
  options: [{
    text: {
      type: String,
      required: true,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  }],
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed, // Can be string, array, or object
  },
  explanation: {
    type: String,
    trim: true,
    maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
  },
  codeTemplate: {
    type: String,
    trim: true,
  },
  testCases: [{
    input: mongoose.Schema.Types.Mixed,
    expectedOutput: mongoose.Schema.Types.Mixed,
    isHidden: {
      type: Boolean,
      default: false,
    },
    description: String,
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  analytics: {
    totalAttempts: {
      type: Number,
      default: 0,
    },
    correctAttempts: {
      type: Number,
      default: 0,
    },
    averageTime: {
      type: Number,
      default: 0,
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null, // null means it's a public question
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isPublic: {
    type: Boolean,
    default: false, // Private by default
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
  totalAttempts: {
    type: Number,
    default: 0,
  },
  version: {
    type: Number,
    default: 1,
  },
  previousVersions: [{
    version: Number,
    question: String,
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for success rate
questionSchema.virtual('successRate').get(function() {
  const a = this.analytics || {};
  const total = a.totalAttempts || 0;
  const correct = a.correctAttempts || 0;
  return total > 0 ? Math.round((correct / total) * 100) : 0;
});

// Virtual for formatted options (for multiple choice)
questionSchema.virtual('formattedOptions').get(function() {
  if (this.type !== QUESTION_TYPES.MULTIPLE_CHOICE) return [];
  
  return this.options.map((option, index) => ({
    ...option.toObject(),
    label: String.fromCharCode(65 + index), // A, B, C, D...
  }));
});

// Indexes for performance
questionSchema.index({ testId: 1 });
questionSchema.index({ type: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ order: 1 });

// Pre-save validation
questionSchema.pre('save', function(next) {
  // Validate multiple choice questions have options
  if (this.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
    if (!this.options || this.options.length < 2) {
      return next(new Error('Multiple choice questions must have at least 2 options'));
    }
    if (this.options.length > 6) {
      return next(new Error('Multiple choice questions cannot have more than 6 options'));
    }
    
    // Ensure at least one correct answer
    const hasCorrectAnswer = this.options.some(option => option.isCorrect);
    if (!hasCorrectAnswer && !this.correctAnswer) {
      return next(new Error('Multiple choice questions must have at least one correct answer'));
    }
  }
  
  // Validate true/false questions
  if (this.type === QUESTION_TYPES.TRUE_FALSE) {
    if (!this.correctAnswer || !['true', 'false'].includes(this.correctAnswer.toLowerCase())) {
      return next(new Error('True/false questions must have correctAnswer set to "true" or "false"'));
    }
  }
  
  next();
});

// Static method to find by test
questionSchema.statics.findByTest = function(testId, conditions = {}) {
  return this.find({ ...conditions, testId }).sort({ order: 1 });
};

// Static method to find by difficulty
questionSchema.statics.findByDifficulty = function(difficulty, conditions = {}) {
  return this.find({ ...conditions, difficulty });
};

// Instance method to update analytics
questionSchema.methods.updateAnalytics = function(isCorrect, timeSpent) {
  // Ensure analytics subdoc exists
  if (!this.analytics) this.analytics = { totalAttempts: 0, correctAttempts: 0, averageTime: 0 };
  this.analytics.totalAttempts = (this.analytics.totalAttempts || 0) + 1;
  if (isCorrect) {
    this.analytics.correctAttempts = (this.analytics.correctAttempts || 0) + 1;
  }

  // Update average time safely
  const prevAttempts = (this.analytics.totalAttempts || 1) - 1;
  const prevAvg = this.analytics.averageTime || 0;
  const currentTotal = prevAvg * prevAttempts;
  const time = Number.isFinite(timeSpent) ? timeSpent : 0;
  this.analytics.averageTime = Math.round((currentTotal + time) / this.analytics.totalAttempts);

  return this.save();
};

// Instance method to check if answer is correct
questionSchema.methods.checkAnswer = function(userAnswer) {
  switch (this.type) {
    case QUESTION_TYPES.MULTIPLE_CHOICE:
      if (this.correctAnswer) {
        return userAnswer === this.correctAnswer;
      }
      // Check against options
      const correctOption = this.options.find(option => option.isCorrect);
      return correctOption && userAnswer === correctOption._id.toString();
      
    case QUESTION_TYPES.TRUE_FALSE:
      return userAnswer.toLowerCase() === this.correctAnswer.toLowerCase();
      
    case QUESTION_TYPES.SHORT_ANSWER:
      // For short answers, we might want fuzzy matching in the future
      return userAnswer.toLowerCase().trim() === this.correctAnswer.toLowerCase().trim();
      
    default:
      return false;
  }
};

module.exports = mongoose.model('Question', questionSchema);
