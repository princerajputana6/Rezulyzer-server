const mongoose = require('mongoose');
const { ATTEMPT_STATUS } = require('../utils/constants');

const testAttemptSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(ATTEMPT_STATUS),
    default: ATTEMPT_STATUS.NOT_STARTED,
  },
  startedAt: Date,
  completedAt: Date,
  expiresAt: Date,
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    answer: {
      type: mongoose.Schema.Types.Mixed, // Can be string, array, or object
      required: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    timeSpent: {
      type: Number, // in seconds
      default: 0,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  }],
  score: {
    type: Number,
    default: 0,
  },
  totalScore: {
    type: Number,
    default: 0,
  },
  percentage: {
    type: Number,
    default: 0,
  },
  timeSpent: {
    type: Number, // total time in seconds
    default: 0,
  },
  isPassed: {
    type: Boolean,
    default: false,
  },
  feedback: {
    overall: String,
    strengths: [String],
    improvements: [String],
    recommendations: [String],
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    browserInfo: {
      name: String,
      version: String,
      os: String,
    },
    screenResolution: String,
    timezone: String,
  },
  flags: {
    suspicious: {
      type: Boolean,
      default: false,
    },
    tabSwitches: {
      type: Number,
      default: 0,
    },
    copyPasteAttempts: {
      type: Number,
      default: 0,
    },
    fullscreenExits: {
      type: Number,
      default: 0,
    },
    events: [{
      type: {
        type: String,
        enum: ['tab_switch', 'fullscreen_exit', 'copy_paste'],
        required: true,
      },
      occurredAt: {
        type: Date,
        default: Date.now,
      }
    }],
  },
  invitationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestInvitation',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for duration in minutes
testAttemptSchema.virtual('durationInMinutes').get(function() {
  return this.timeSpent ? Math.round(this.timeSpent / 60) : 0;
});

// Virtual for formatted duration
testAttemptSchema.virtual('formattedDuration').get(function() {
  if (!this.timeSpent) return '0 minutes';
  
  const minutes = Math.floor(this.timeSpent / 60);
  const seconds = this.timeSpent % 60;
  
  if (minutes === 0) {
    return `${seconds} seconds`;
  } else if (seconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${minutes}m ${seconds}s`;
  }
});

// Virtual for remaining time
testAttemptSchema.virtual('remainingTime').get(function() {
  if (!this.expiresAt || this.status === ATTEMPT_STATUS.COMPLETED) return 0;
  
  const now = new Date();
  const remaining = Math.max(0, Math.floor((this.expiresAt - now) / 1000));
  return remaining;
});

// Virtual for is expired
testAttemptSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt && this.status !== ATTEMPT_STATUS.COMPLETED;
});

// Compound indexes for performance
testAttemptSchema.index({ testId: 1, userId: 1 }, { unique: true });
testAttemptSchema.index({ userId: 1, createdAt: -1 });
testAttemptSchema.index({ testId: 1, status: 1 });
testAttemptSchema.index({ status: 1, expiresAt: 1 });

// Pre-save middleware to calculate scores
testAttemptSchema.pre('save', async function(next) {
  if (this.isModified('answers') || this.isNew) {
    await this.populate('testId');
    await this.populate('answers.questionId');
    
    let correctAnswers = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    
    for (const answer of this.answers) {
      const question = answer.questionId;
      if (question) {
        totalPoints += question.points || 1;
        
        // Check if answer is correct
        const isCorrect = question.checkAnswer(answer.answer);
        answer.isCorrect = isCorrect;
        
        if (isCorrect) {
          correctAnswers++;
          earnedPoints += question.points || 1;
        }
      }
    }
    
    this.score = earnedPoints;
    this.totalScore = totalPoints;
    this.percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    
    // Check if passed
    if (this.testId && this.testId.passingScore) {
      this.isPassed = this.percentage >= this.testId.passingScore;
    }
  }
  
  next();
});

// Static method to find by user
testAttemptSchema.statics.findByUser = function(userId, conditions = {}) {
  return this.find({ ...conditions, userId }).populate('testId', 'title type duration');
};

// Static method to find by test
testAttemptSchema.statics.findByTest = function(testId, conditions = {}) {
  return this.find({ ...conditions, testId }).populate('userId', 'firstName lastName email');
};

// Static method to find completed attempts
testAttemptSchema.statics.findCompleted = function(conditions = {}) {
  return this.find({ ...conditions, status: ATTEMPT_STATUS.COMPLETED });
};

// Instance method to start attempt
testAttemptSchema.methods.start = function(duration) {
  this.status = ATTEMPT_STATUS.IN_PROGRESS;
  this.startedAt = new Date();
  this.expiresAt = new Date(Date.now() + duration * 60 * 1000); // duration in minutes
  return this.save();
};

// Instance method to submit attempt
testAttemptSchema.methods.submit = function() {
  this.status = ATTEMPT_STATUS.COMPLETED;
  this.completedAt = new Date();
  
  if (this.startedAt) {
    this.timeSpent = Math.floor((this.completedAt - this.startedAt) / 1000);
  }
  
  return this.save();
};

// Instance method to calculate current score based on answers
testAttemptSchema.methods.calculateScore = async function() {
  // Populate test and questions referenced in answers
  await this.populate('testId');
  await this.populate('answers.questionId');

  let earnedPoints = 0;
  let totalPoints = 0;

  for (const ans of this.answers) {
    const q = ans.questionId;
    if (!q) continue;
    const pts = q.points || 1;
    totalPoints += pts;
    const correct = q.checkAnswer ? q.checkAnswer(ans.answer) : false;
    ans.isCorrect = !!correct;
    if (correct) earnedPoints += pts;
  }

  this.score = earnedPoints;
  this.totalScore = totalPoints;
  this.percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  // Determine pass/fail if passingScore set on test
  if (this.testId && this.testId.passingScore != null) {
    this.isPassed = this.percentage >= this.testId.passingScore;
  }

  return this.save();
};

// Instance method to expire attempt
testAttemptSchema.methods.expire = function() {
  this.status = ATTEMPT_STATUS.EXPIRED;
  this.completedAt = new Date();
  
  if (this.startedAt) {
    this.timeSpent = Math.floor((this.completedAt - this.startedAt) / 1000);
  }
  
  return this.save();
};

// Instance method to add answer
testAttemptSchema.methods.addAnswer = function(questionId, answer, timeSpent = 0) {
  const existingAnswerIndex = this.answers.findIndex(
    a => a.questionId.toString() === questionId.toString()
  );
  
  const answerData = {
    questionId,
    answer,
    timeSpent,
    answeredAt: new Date(),
  };
  
  if (existingAnswerIndex !== -1) {
    this.answers[existingAnswerIndex] = answerData;
  } else {
    this.answers.push(answerData);
  }
  
  return this.save();
};

// Instance method to flag suspicious activity
testAttemptSchema.methods.flagSuspicious = function(type, occurredAt) {
  this.flags.suspicious = true;
  
  switch (type) {
    case 'tab_switch':
      this.flags.tabSwitches++;
      break;
    case 'copy_paste':
      this.flags.copyPasteAttempts++;
      break;
    case 'fullscreen_exit':
      this.flags.fullscreenExits++;
      break;
  }
  this.flags.events = this.flags.events || [];
  this.flags.events.push({ type, occurredAt: occurredAt ? new Date(occurredAt) : new Date() });
  
  return this.save();
};

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
