const axios = require('axios');
const Candidate = require('../models/Candidate');
const Company = require('../models/Company');
const Test = require('../models/Test');
const Question = require('../models/Question');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validationResult } = require('express-validator');
const s3Service = require('../services/s3Service');
const { processResume: processResumeAI } = require('../services/resumeParserService');
const { sendAssessmentEmail } = require('../services/emailService');
const aiService = require('../config/ai');
const crypto = require('crypto');

// Configure multer for memory storage (files will be uploaded to S3)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
  }
};

// Normalize and validate MCQ questions coming from AI
function normalizeMcqItems(items, fallbackCount = 10) {
  const allowedDifficulties = new Set(['easy','medium','hard']);
  const out = [];
  const arr = Array.isArray(items) ? items : [];
  for (const raw of arr) {
    const qText = (raw?.question || '').toString().trim();
    if (!qText) continue;
    // Options: ensure exactly 4 strings
    let opts = Array.isArray(raw?.options) ? raw.options.slice(0, 4) : [];
    opts = opts.map(o => (o || '').toString());
    while (opts.length < 4) opts.push('');
    const labels = ['A','B','C','D'];
    const normalizedOptions = opts.slice(0,4).map((opt, i) => {
      // Strip leading label like "A) " if present
      const clean = opt.replace(/^\s*[A-D]\)\s*/i, '').trim();
      return clean || `Option ${labels[i]}`;
    });

    // Correct answer letter
    let letter = (raw?.correctAnswer || '').toString().trim().toUpperCase();
    if (!['A','B','C','D'].includes(letter)) {
      // Try to infer by matching text if options contain the answer text
      const answerText = (raw?.correctAnswer || '').toString().trim();
      const idx = normalizedOptions.findIndex(o => o.toLowerCase() === answerText.toLowerCase());
      letter = idx >= 0 ? labels[idx] : 'A';
    }
    const correctIndex = letter.charCodeAt(0) - 65; // A->0

    // Difficulty
    let diff = (raw?.difficulty || '').toString().toLowerCase();
    if (!allowedDifficulties.has(diff)) diff = 'medium';

    const explanation = (raw?.explanation || '').toString().trim() || 'Refer to the correct option.';

    out.push({
      question: qText,
      options: normalizedOptions,
      correctLetter: letter,
      correctIndex,
      explanation,
      difficulty: diff,
      type: 'multiple_choice',
      points: Number.isFinite(raw?.points) ? raw.points : 10,
    });
  }
  // Ensure at least fallbackCount by truncating/keeping available items
  return out.slice(0, Math.max(0, fallbackCount));
}

// @desc    Generate an AI-powered assessment based on candidate resume/profile
// @route   POST /api/candidates/:id/generate-assessment
// @access  Private (Company)
const generateAssessment = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid candidate ID' });
    }

    const companyId = req.user.companyId || req.user._id;
    // Try with company scoping first; fallback to byId to avoid false negatives during testing
    let candidate = await Candidate.findOne({ _id: req.params.id, companyId });
    if (!candidate) {
      candidate = await Candidate.findById(req.params.id);
    }

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Build resume text from stored fields as a fallback if raw resume text isn't available
    const skills = [
      ...(candidate.skills?.technical?.map(s => s.name) || []),
      ...(candidate.skills?.soft || [])
    ];
    const experiences = (candidate.experience || [])
      .map(e => `${e.title || ''} at ${e.company || ''} (${e.location || ''})`) 
      .join('\n');
    const education = (candidate.education || [])
      .map(ed => `${ed.degree || ''} at ${ed.institution || ''}`)
      .join('\n');
    const resumeText = `Name: ${candidate.name}\nEmail: ${candidate.email}\nSummary: ${candidate.summary || ''}\nSkills: ${skills.join(', ')}\nExperience: ${experiences}\nEducation: ${education}`;

    const questionCount = Math.max(5, Math.min(20, parseInt(req.body.count) || 10));
    const provider = (req.body.provider || process.env.AI_PROVIDER || 'openai').toLowerCase();
    const model = req.body.model; // optional override

    let aiQuestions = [];
    try {
      // Allow per-request provider/model override safely
      aiQuestions = await aiService.withOverrides({ provider, model }, async () => {
        return await aiService.generateQuestions(resumeText, 'multiple_choice', questionCount);
      });
    } catch (e) {
      // Fallback: generate simple MCQs from skills if AI is unavailable
      aiQuestions = (skills.slice(0, questionCount) || ['General']).map((skill, idx) => ({
        question: `Which of the following best describes ${skill}?`,
        options: [
          'A) A frontend framework',
          'B) A backend runtime',
          'C) A programming paradigm',
          'D) A testing library'
        ],
        correctAnswer: 'A',
        explanation: `This is a placeholder question about ${skill}.`,
        difficulty: 'medium',
        type: 'multiple_choice',
        points: 10
      }));
    }

    // Normalize and validate
    const normalized = normalizeMcqItems(aiQuestions, questionCount);
    if (normalized.length === 0) {
      return res.status(400).json({ success: false, message: 'AI did not return valid MCQs' });
    }

    // Create Question documents
    const createdQuestions = [];
    for (const q of normalized) {
      const optionsArray = q.options.map((text, idx) => ({ text, isCorrect: idx === q.correctIndex }));

      const questionDoc = new Question({
        question: q.question,
        type: 'multiple-choice',
        domain: 'Aptitude',
        subDomain: '',
        difficulty: q.difficulty,
        points: q.points,
        options: optionsArray,
        correctAnswer: q.correctLetter,
        explanation: q.explanation,
        createdBy: req.user._id,
        companyId: companyId
      });
      await questionDoc.save();
      createdQuestions.push(questionDoc._id);
    }

    // Create Test document
    const testTitle = `Assessment for ${candidate.name}`;
    const test = new Test({
      title: testTitle,
      description: `Auto-generated assessment based on ${candidate.name}'s resume`,
      type: 'technical',
      duration: 30,
      createdBy: req.user._id,
      questions: createdQuestions,
      difficulty: 'mixed',
      settings: { shuffleQuestions: true, shuffleOptions: true, preventCheating: true, timeLimit: true, autoSubmit: true },
      status: 'published',
      publishedAt: new Date()
    });
    await test.save();

    // Assign test to candidate
    candidate.assignedTests = candidate.assignedTests || [];
    candidate.assignedTests.push({ testId: test._id, assignedBy: req.user._id, assignedAt: new Date(), status: 'pending' });
    await candidate.save();

    res.status(201).json({ success: true, data: { testId: test._id, totalQuestions: createdQuestions.length } });
  } catch (error) {
    console.error('Generate assessment error:', error);
    res.status(500).json({ success: false, message: 'Server error while generating assessment' });
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Parse resume using APILayer API
const parseResume = async (fileBuffer) => {
  const safeParseDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };

  try {
    const response = await axios.post('https://api.apilayer.com/resume_parser/upload', fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'apikey': process.env.APILAYER_API_KEY
      }
    });

    const parsedData = response.data;

    // Validate phone number against the schema regex
    const phoneRegex = /^[\+]?[^\D][\d\s\-\(\)]{0,20}$/;
    const validPhone = parsedData.phone && phoneRegex.test(parsedData.phone) ? parsedData.phone : '';

    // Map the parsed data to the Candidate model schema
    const candidateData = {
      name: parsedData.name || '',
      email: parsedData.email || `candidate_${Date.now()}@example.com`,
      phone: validPhone,
      location: parsedData.location || '',
      linkedinUrl: parsedData.linkedin_url || '',
      portfolioUrl: parsedData.website || '',
      summary: parsedData.summary || '',
      skills: {
        technical: parsedData.skills ? parsedData.skills.map(skill => ({ name: skill, level: 'Advanced', years: 1 })) : [],
        soft: []
      },
      experience: parsedData.experience ? parsedData.experience.map(exp => ({
        title: exp.title || '',
        company: exp.organization || '',
        location: exp.location || '',
        startDate: safeParseDate(Array.isArray(exp.dates) ? exp.dates[exp.dates.length - 1] : exp.dates),
        description: exp.description || ''
      })) : [],
      education: parsedData.education ? parsedData.education.map(edu => ({
        institution: edu.name || '',
        degree: '',
        startDate: safeParseDate(Array.isArray(edu.dates) ? edu.dates[0] : edu.dates)
      })) : [],
      currentPosition: {
        title: parsedData.experience && parsedData.experience[0] ? parsedData.experience[0].title : '',
        company: parsedData.experience && parsedData.experience[0] ? parsedData.experience[0].organization : ''
      },
      certifications: [],
      projects: []
    };

    return candidateData;
  } catch (error) {
    console.error('Error parsing resume with APILayer:', error.response ? error.response.data : error.message);
    throw new Error('Failed to parse resume');
  }
};

// @desc    Get all candidates for a company
// @route   GET /api/candidates
// @access  Private (Company)
const getCandidates = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const mongoose = require('mongoose');
    const testCompanyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    const companyId = req.user?.companyId || req.user?._id || testCompanyId;

    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'currentPosition.title': { $regex: search, $options: 'i' } },
        { 'currentPosition.company': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }

    const candidates = await Candidate.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('assignedTests.testId', 'title')
      .populate('completedTests.testId', 'title');

    const total = await Candidate.countDocuments(query);

    res.json({
      success: true,
      data: candidates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching candidates'
    });
  }
};

// @desc    Get single candidate
// @route   GET /api/candidates/:id
// @access  Private (Company)
const getCandidate = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const testCompanyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    const companyId = req.user?.companyId || req.user?._id || testCompanyId;
    
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      // companyId // Temporarily disabled for testing
    })
      .populate('assignedTests.testId', 'title description')
      .populate('completedTests.testId', 'title description')
      .populate('assignedTests.assignedBy', 'name email');

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching candidate'
    });
  }
};

// @desc    Upload and process resume
// @route   POST /api/candidates/upload-resume
// @access  Private (Company)
const handleResumeUpload = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const testCompanyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    const companyId = req.user?.companyId || req.user?._id || testCompanyId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file uploaded'
      });
    }

    const { file } = req;
    
    let uploadResult;
    
    try {
      uploadResult = await s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'resumes'
      );
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }
    } catch (s3Error) {
      console.warn('[WARN] S3 upload failed, using local storage fallback:', s3Error.message);
      
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = require('path').extname(file.originalname);
      const localFileName = `${timestamp}_${randomString}${extension}`;
      const uploadDir = path.join(__dirname, '../../uploads/resumes');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fullPath = path.join(uploadDir, localFileName);
      fs.writeFileSync(fullPath, file.buffer);
      
      uploadResult = {
        success: true,
        s3Key: `local:${localFileName}`,
        fileUrl: `/uploads/resumes/${localFileName}`,
        bucket: 'local-storage',
        originalName: file.originalname
      };
    }

    // Prefer AI-powered parsing for higher accuracy
    let extractedData;
    try {
      extractedData = await processResumeAI(file.buffer, file.mimetype, file.originalname);
    } catch (aiErr) {
      console.warn('[WARN] AI resume parsing failed, falling back to APILayer:', aiErr.message);
      extractedData = await parseResume(file.buffer);
    }

    const existingCandidate = await Candidate.findOne({
      email: extractedData.email,
      companyId
    });

    if (existingCandidate) {
      return res.status(409).json({
        success: false,
        message: 'Candidate with this email already exists',
        data: { candidateId: existingCandidate._id }
      });
    }

    const candidateData = {
      ...extractedData,
      companyId,
      resumeInfo: {
        fileName: uploadResult.s3Key,
        originalName: file.originalname,
        filePath: uploadResult.fileUrl,
        s3Key: uploadResult.s3Key,
        s3Bucket: uploadResult.bucket,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadDate: new Date(),
        extractedDate: new Date(),
        extractionStatus: 'completed'
      },
      applicationInfo: {
        appliedDate: new Date(),
        source: 'resume_upload',
        lastActivity: new Date()
      }
    };

    const candidate = new Candidate(candidateData);
    await candidate.save();

    res.status(201).json({
      success: true,
      message: 'Resume uploaded and candidate created successfully',
      data: candidate
    });
  } catch (error) {
    console.error('[ERROR] Upload resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing resume',
      error: error.message
    });
  }
};

// @desc    Create candidate manually
// @route   POST /api/candidates
// @access  Private (Company)
const createCandidate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const companyId = req.user.companyId || req.user._id;
    
    const existingCandidate = await Candidate.findOne({
      email: req.body.email,
      companyId
    });

    if (existingCandidate) {
      return res.status(409).json({
        success: false,
        message: 'Candidate with this email already exists'
      });
    }

    const candidateData = {
      ...req.body,
      companyId,
      applicationInfo: {
        appliedDate: new Date(),
        source: 'manual_entry',
        lastActivity: new Date()
      }
    };

    const candidate = new Candidate(candidateData);
    await candidate.save();

    res.status(201).json({
      success: true,
      message: 'Candidate created successfully',
      data: candidate
    });
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating candidate'
    });
  }
};

// @desc    Update candidate
// @route   PUT /api/candidates/:id
// @access  Private (Company)
const updateCandidate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const companyId = req.user.companyId || req.user._id;
    
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      companyId
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    if (req.body.email && req.body.email !== candidate.email) {
      const existingCandidate = await Candidate.findOne({
        email: req.body.email,
        companyId,
        _id: { $ne: req.params.id }
      });

      if (existingCandidate) {
        return res.status(409).json({
          success: false,
          message: 'Another candidate with this email already exists'
        });
      }
    }

    Object.assign(candidate, req.body);
    candidate.applicationInfo.lastActivity = new Date();
    
    await candidate.save();

    res.json({
      success: true,
      message: 'Candidate updated successfully',
      data: candidate
    });
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating candidate'
    });
  }
};

// @desc    Delete candidate
// @route   DELETE /api/candidates/:id
// @access  Private (Company)
const deleteCandidate = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      companyId
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    if (candidate.resumeInfo && candidate.resumeInfo.s3Key) {
      try {
        await s3Service.deleteFile(candidate.resumeInfo.s3Key);
      } catch (fileError) {
        console.error('Error deleting resume file from S3:', fileError);
      }
    }

    await Candidate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting candidate'
    });
  }
};

// @desc    Download candidate resume
// @route   GET /api/candidates/:id/resume
// @access  Private (Company)
const downloadResume = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const testCompanyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    const companyId = req.user?.companyId || req.user?._id || testCompanyId;

    const candidate = await Candidate.findOne({
      _id: req.params.id,
      // companyId // Temporarily disabled for testing
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    if (!candidate.resumeInfo || !candidate.resumeInfo.s3Key) {
      return res.status(404).json({
        success: false,
        message: 'Resume file not found'
      });
    }

    if (candidate.resumeInfo.s3Key.startsWith('local:')) {
      const fileName = candidate.resumeInfo.s3Key.replace('local:', '');
      const filePath = path.join(__dirname, '../../uploads/resumes', fileName);
      return res.download(filePath, candidate.resumeInfo.originalName);
    }

    try {
      const signedUrl = await s3Service.getSignedUrl(candidate.resumeInfo.s3Key, 300);
      res.json({
        success: true,
        downloadUrl: signedUrl,
        fileName: candidate.resumeInfo.originalName
      });
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return res.status(500).json({
        success: false,
        message: 'Error generating download link'
      });
    }
  } catch (error) {
    console.error('Download resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while downloading resume'
    });
  }
};

// @desc    Get candidate statistics
// @route   GET /api/candidates/stats
// @access  Private (Company)
const getCandidateStats = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const testCompanyId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    const companyId = req.user?.companyId || req.user?._id || testCompanyId;

    const stats = await Candidate.aggregate([
      { $match: {} },
      {
        $group: {
          _id: null,
          totalCandidates: { $sum: 1 },
          activeCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          totalTestsAssigned: { $sum: '$totalTestsAssigned' },
          totalTestsCompleted: { $sum: '$totalTestsCompleted' },
          averageScore: { $avg: '$averageScore' }
        }
      }
    ]);

    const result = stats[0] || {
      totalCandidates: 0,
      activeCandidates: 0,
      inactiveCandidates: 0,
      totalTestsAssigned: 0,
      totalTestsCompleted: 0,
      averageScore: 0
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get candidate stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching candidate statistics'
    });
  }
};

const uploadResume = [upload.single('resume'), handleResumeUpload];

// @desc    Send assessment invitation to a candidate
// @route   POST /api/candidates/:id/send-assessment
// @access  Private (Company)
const sendAssessment = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid candidate ID' });
    }
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Generate a random password
    const password = crypto.randomBytes(8).toString('hex');
    candidate.password = password;
    await candidate.save();

    // Build login URL with latest assigned testId if present
    let latestTestId = null;
    if (candidate.assignedTests && candidate.assignedTests.length > 0) {
      const sorted = candidate.assignedTests
        .slice()
        .sort((a, b) => new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0));
      latestTestId = sorted[0].testId?.toString();
    }
    const baseClient = process.env.CLIENT_URL || 'http://localhost:3000';
    const loginUrl = latestTestId
      ? `${baseClient}/assessment-login?testId=${latestTestId}`
      : `${baseClient}/assessment-login`;

    // Send the assessment email
    await sendAssessmentEmail(candidate.email, {
      candidateName: candidate.name,
      companyName: (req.user.company && req.user.company.name) || 'Your Company',
      email: candidate.email,
      password: password,
      loginUrl
    });

    res.json({
      success: true,
      message: 'Assessment invitation sent successfully'
    });
  } catch (error) {
    console.error('Send assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending assessment'
    });
  }
};

module.exports = {
  getCandidates,
  getCandidate,
  uploadResume,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  downloadResume,
  getCandidateStats,
  sendAssessment,
  generateAssessment
};
