const { generateQuestions, analyzeResume, suggestTests } = require('../config/ai');
const AuditLog = require('../models/AuditLog');
const { asyncHandler } = require('../middleware/errorHandler');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');
const { createSuccessResponse, createErrorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// @desc    Generate AI questions
// @route   POST /api/ai/generate-questions
// @access  Private
const generateAIQuestions = asyncHandler(async (req, res) => {
  const {
    prompt = 'Generate technical questions',
    count = 5,
    difficulty = 'medium',
    type = 'multiple_choice',
    subject = 'General'
  } = req.body;

  let resumeText = null;

  // If resume file is uploaded, extract text
  if (req.file) {
    try {
      const filePath = req.file.path;
      const fileContent = await fs.readFile(filePath, 'utf8');
      resumeText = fileContent;
      
      // Clean up uploaded file
      await fs.unlink(filePath);
    } catch (error) {
      logger.error('Error processing resume file:', error);
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        createErrorResponse('Failed to process resume file')
      );
    }
  }

  try {
    const questions = await generateQuestions({
      prompt,
      count: parseInt(count),
      difficulty,
      type,
      subject,
      resumeText
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'ai_questions_generated',
      details: {
        count: questions.length,
        difficulty,
        type,
        subject,
        hasResume: !!resumeText
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.info(`AI questions generated: ${questions.length} questions for user ${req.user.email}`);

    res.json(
      createSuccessResponse('Questions generated successfully', {
        questions,
        metadata: {
          count: questions.length,
          difficulty,
          type,
          subject,
          generatedAt: new Date().toISOString()
        }
      })
    );
  } catch (error) {
    logger.error('AI question generation failed:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      createErrorResponse('Failed to generate questions. Please try again.')
    );
  }
});

// @desc    Analyze resume
// @route   POST /api/ai/analyze-resume
// @access  Private
const analyzeResumeFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('Resume file is required')
    );
  }

  const { jobDescription } = req.body;

  try {
    const filePath = req.file.path;
    const resumeText = await fs.readFile(filePath, 'utf8');
    
    // Clean up uploaded file
    await fs.unlink(filePath);

    const analysis = await analyzeResume({
      resumeText,
      jobDescription
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'resume_analyzed',
      details: {
        hasJobDescription: !!jobDescription,
        fileName: req.file.originalname
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.info(`Resume analyzed for user ${req.user.email}`);

    res.json(
      createSuccessResponse('Resume analyzed successfully', {
        analysis,
        metadata: {
          fileName: req.file.originalname,
          analyzedAt: new Date().toISOString()
        }
      })
    );
  } catch (error) {
    // Clean up file if it still exists
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.warn('Failed to clean up uploaded file:', unlinkError);
      }
    }

    logger.error('Resume analysis failed:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      createErrorResponse('Failed to analyze resume. Please try again.')
    );
  }
});

// @desc    Suggest tests based on skills
// @route   POST /api/ai/suggest-tests
// @access  Private
const suggestTestsForSkills = asyncHandler(async (req, res) => {
  const {
    skills,
    experience = 'mid',
    role
  } = req.body;

  try {
    const suggestions = await suggestTests({
      skills,
      experience,
      role
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'test_suggestions_generated',
      details: {
        skills,
        experience,
        role,
        suggestionsCount: suggestions.length
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.info(`Test suggestions generated for user ${req.user.email}`);

    res.json(
      createSuccessResponse('Test suggestions generated successfully', {
        suggestions,
        metadata: {
          skills,
          experience,
          role,
          generatedAt: new Date().toISOString()
        }
      })
    );
  } catch (error) {
    logger.error('Test suggestion generation failed:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      createErrorResponse('Failed to generate test suggestions. Please try again.')
    );
  }
});

module.exports = {
  generateQuestions: generateAIQuestions,
  analyzeResume: analyzeResumeFile,
  suggestTests: suggestTestsForSkills
};
