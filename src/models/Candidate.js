const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const candidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Candidate name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
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
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d\s\-\(\)]{0,20}$/, 'Please enter a valid phone number'],
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  assignedTests: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'expired'],
      default: 'pending',
    },
    invitationSent: {
      type: Boolean,
      default: false,
    },
    invitationSentAt: Date,
  }],
  completedTests: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestResult',
    },
    completedAt: Date,
    score: Number,
    percentage: Number,
    status: {
      type: String,
      enum: ['passed', 'failed'],
    },
  }],
  // Basic Profile Information
  location: String,
  dateOfBirth: Date,
  nationality: String,
  linkedinUrl: String,
  portfolioUrl: String,
  
  // Professional Summary
  summary: String,
  
  // Current Position
  currentPosition: {
    title: String,
    company: String,
    startDate: Date,
    endDate: Date,
    description: String
  },
  
  // Work Experience
  experience: [{
    title: String,
    company: String,
    location: String,
    startDate: Date,
    endDate: Date,
    current: { type: Boolean, default: false },
    description: String,
    achievements: [String]
  }],
  
  // Education
  education: [{
    degree: String,
    institution: String,
    location: String,
    startDate: Date,
    endDate: Date,
    gpa: String,
    achievements: [String]
  }],
  
  // Skills
  skills: {
    technical: [{
      name: String,
      level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
      years: Number
    }],
    soft: [String]
  },
  
  // Certifications
  certifications: [{
    name: String,
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    credentialId: String
  }],
  
  // Projects
  projects: [{
    name: String,
    description: String,
    technologies: [String],
    url: String,
    startDate: Date,
    endDate: Date
  }],
  
  // Parsed resume structured data (full details from parser)
  parsedProfile: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Raw OpenResume JSON (as returned by the OpenResume parser)
  openResumeProfile: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // OpenResume-shaped structured data for first-class querying and UI consumption
  openResumeData: {
    basics: {
      name: String,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      address: {
        streetAddress: String,
        city: String,
        region: String,
        postalCode: String,
        country: String,
      },
      profiles: {
        linkedin: String,
        github: String,
        portfolio: String,
        website: String,
        other: [String],
      },
      summary: String,
      objective: String,
    },
    work: [{
      company: String,
      position: String,
      title: String,
      location: String,
      startDate: Date,
      endDate: Date,
      isCurrent: { type: Boolean, default: false },
      summary: String,
      highlights: [String],
      technologies: [String],
      tools: [String],
      teamSize: String,
      reportingTo: String,
    }],
    education: [{
      institution: String,
      school: String,
      university: String,
      degree: String,
      studyType: String,
      field: String,
      area: String,
      location: String,
      startDate: Date,
      endDate: Date,
      graduationDate: Date,
      gpa: String,
      courses: [String],
      honors: [String],
    }],
    skills: [{
      name: String,
      level: String,
      keywords: [String],
      items: [String],
    }],
    projects: [{
      name: String,
      title: String,
      description: String,
      url: String,
      link: String,
      keywords: [String],
      technologies: [String],
      tools: [String],
      achievements: [String],
      startDate: Date,
      endDate: Date,
    }],
    certifications: [{
      name: String,
      title: String,
      issuer: String,
      awarder: String,
      date: Date,
      url: String,
      credentialId: String,
    }],
    languages: [{
      language: String,
      proficiency: String,
    }],
    publications: [{
      title: String,
      journal: String,
      date: Date,
      authors: [String],
      url: String,
    }],
    volunteering: [{
      organization: String,
      role: String,
      duration: String,
      description: String,
    }],
    additionalInfo: {
      availability: String,
      noticePeriod: String,
      expectedSalary: String,
      willingToRelocate: String,
      visaStatus: String,
      references: [String],
      hobbies: [String],
      interests: [String],
    },
  },
  
  // Resume Information
  resumeInfo: {
    fileName: String,
    originalName: String,
    filePath: String,
    s3Key: String,
    s3Bucket: String,
    fileSize: Number,
    mimeType: String,
    uploadDate: { type: Date, default: Date.now },
    extractedDate: Date,
    extractionStatus: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'], 
      default: 'pending' 
    }
  },
  
  // Application Information
  applicationInfo: {
    appliedDate: { type: Date, default: Date.now },
    source: { 
      type: String, 
      enum: ['resume_upload', 'manual_entry', 'job_board', 'referral'], 
      default: 'resume_upload' 
    },
    lastActivity: { type: Date, default: Date.now }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active',
  },
  notes: String,
  tags: [String],
  lastActivity: Date,
  totalTestsAssigned: {
    type: Number,
    default: 0,
  },
  totalTestsCompleted: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
  // Assessment Authentication
  assessmentPassword: {
    type: String,
    trim: true,
  },
  assessmentToken: {
    type: String,
    trim: true,
  },
  assessmentTokenExpiry: {
    type: Date,
  },
  assessmentSessionToken: {
    type: String,
    trim: true,
  },
  assessmentSessionExpiry: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
candidateSchema.index({ email: 1 });
candidateSchema.index({ companyId: 1 });
candidateSchema.index({ status: 1 });
candidateSchema.index({ createdAt: -1 });
candidateSchema.index({ 'assignedTests.testId': 1 });
candidateSchema.index({ assessmentToken: 1 }); // For assessment login lookup

// Pre-save hook to hash password
candidateSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for completion rate
candidateSchema.virtual('completionRate').get(function() {
  return this.totalTestsAssigned > 0 
    ? Math.round((this.totalTestsCompleted / this.totalTestsAssigned) * 100)
    : 0;
});

// Virtual for pending tests count
candidateSchema.virtual('pendingTestsCount').get(function() {
  return this.assignedTests.filter(test => test.status === 'pending').length;
});

// Instance method to assign test
candidateSchema.methods.assignTest = function(testId, assignedBy, dueDate = null) {
  // Check if test is already assigned
  const existingAssignment = this.assignedTests.find(
    test => test.testId.toString() === testId.toString()
  );
  
  if (existingAssignment) {
    throw new Error('Test is already assigned to this candidate');
  }
  
  this.assignedTests.push({
    testId,
    assignedBy,
    dueDate,
    assignedAt: new Date(),
  });
  
  this.totalTestsAssigned += 1;
  return this.save();
};

// Instance method to complete test
candidateSchema.methods.completeTest = function(testId, resultId, score, percentage, status) {
  // Update assigned test status
  const assignedTest = this.assignedTests.find(
    test => test.testId.toString() === testId.toString()
  );
  
  if (assignedTest) {
    assignedTest.status = 'completed';
  }
  
  // Add to completed tests
  this.completedTests.push({
    testId,
    resultId,
    completedAt: new Date(),
    score,
    percentage,
    status,
  });
  
  this.totalTestsCompleted += 1;
  this.lastActivity = new Date();
  
  // Recalculate average score
  const totalScore = this.completedTests.reduce((sum, test) => sum + test.percentage, 0);
  this.averageScore = Math.round(totalScore / this.completedTests.length);
  
  return this.save();
};

// Static method to find by company
candidateSchema.statics.findByCompany = function(companyId, conditions = {}) {
  return this.find({ ...conditions, companyId });
};

// Static method to find active candidates
candidateSchema.statics.findActive = function(conditions = {}) {
  return this.find({ ...conditions, status: 'active' });
};

// Static method to get candidates with pending tests
candidateSchema.statics.findWithPendingTests = function(companyId = null) {
  const match = {
    'assignedTests.status': 'pending',
  };
  
  if (companyId) {
    match.companyId = companyId;
  }
  
  return this.find(match);
};

module.exports = mongoose.model('Candidate', candidateSchema);
