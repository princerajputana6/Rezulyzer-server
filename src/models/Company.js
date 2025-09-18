const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const companySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
    default: 'company',
    enum: ['company'],
    select: false,
  },
  isFirstLogin: {
    type: Boolean,
    default: true,
  },
  passwordResetRequired: {
    type: Boolean,
    default: true,
  },
  lastPasswordReset: {
    type: Date,
    default: null,
  },
  logo: {
    type: String,
    default: null,
  },
  industry: {
    type: String,
    required: [true, 'Industry is required'],
    enum: [
      'Technology',
      'Healthcare',
      'Finance',
      'Education',
      'Manufacturing',
      'Retail',
      'Consulting',
      'Government',
      'Non-profit',
      'Other'
    ],
  },
  size: {
    type: String,
    required: [true, 'Company size is required'],
    enum: [
      '1-10',
      '11-50',
      '51-200',
      '201-500',
      '501-1000',
      '1000+'
    ],
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
  },
  contactPerson: {
    name: {
      type: String,
      required: [true, 'Contact person name is required'],
    },
    email: {
      type: String,
      required: [true, 'Contact person email is required'],
    },
    phone: String,
    designation: String,
  },
  subscriptionPlan: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'enterprise'],
    default: 'basic',
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'trial'],
    default: 'trial',
  },
  creditsRemaining: {
    type: Number,
    default: 100, // Default credits for new companies
  },
  totalCreditsUsed: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  billingInfo: {
    billingEmail: String,
    taxId: String,
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'paypal', 'invoice'],
      default: 'credit_card',
    },
  },
  settings: {
    allowCandidateRegistration: {
      type: Boolean,
      default: true,
    },
    testTimeLimit: {
      type: Number,
      default: 60, // minutes
    },
    maxTestAttempts: {
      type: Number,
      default: 3,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    customBranding: {
      type: Boolean,
      default: false,
    },
  },
  lastLogin: Date,
  refreshToken: {
    type: String,
    select: false,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  passwordResetToken: String,
  passwordResetExpire: Date,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
companySchema.index({ email: 1 });
companySchema.index({ companyName: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ subscriptionStatus: 1 });
companySchema.index({ status: 1 });
companySchema.index({ createdAt: -1 });

// Virtual for total candidates
companySchema.virtual('totalCandidates', {
  ref: 'User',
  localField: '_id',
  foreignField: 'companyId',
  count: true,
});

// Virtual for total tests
companySchema.virtual('totalTests', {
  ref: 'Test',
  localField: '_id',
  foreignField: 'companyId',
  count: true,
});

// Pre-save middleware to hash password
companySchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
companySchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to deduct credits
companySchema.methods.deductCredits = async function(amount) {
  if (this.creditsRemaining < amount) {
    throw new Error('Insufficient credits');
  }
  
  this.creditsRemaining -= amount;
  this.totalCreditsUsed += amount;
  return await this.save();
};

// Instance method to add credits
companySchema.methods.addCredits = async function(amount) {
  this.creditsRemaining += amount;
  return await this.save();
};

// Static method to find by email
companySchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active companies
companySchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, status: 'active' });
};

module.exports = mongoose.model('Company', companySchema);
