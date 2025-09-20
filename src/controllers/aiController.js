const aiService = require('../config/ai');
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
    // If AI provider API key is missing, skip calling provider and use fallback immediately
  if (!aiService.apiKey) {
    logger.warn('AI provider API key missing; using fallback questions');
    const c = parseInt(count) || 5;
    const buildFallback = () => Array.from({ length: c }).map((_, i) => {
      if (type === 'multiple_choice') {
        return {
          question: `(${subject}) Placeholder MCQ #${i + 1}: What is true about ${subject}?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'A',
          explanation: `Basic ${subject} knowledge.`,
          difficulty,
          type: 'multiple_choice',
          points: 10
        };
      } else if (type === 'essay') {
        return {
          question: `(${subject}) Output-based #${i + 1}: Provide the expected output for the given scenario.`,
          explanation: `Key points about ${subject} output.`,
          difficulty,
          type: 'essay',
          points: 10
        };
      } else if (type === 'coding') {
        return {
          question: `(${subject}) Practical #${i + 1}: Implement a function related to ${subject}.`,
          starterCode: `function solve(input) {\n  // TODO: implement\n  return null;\n}`,
          tests: [
            { input: 'sample', expected: 'expected' }
          ],
          explanation: `Write clean code and handle edge-cases.`,
          difficulty,
          type: 'coding',
          points: 10
        };
      }
      return { question: `Placeholder Question #${i + 1}`, explanation: 'N/A', difficulty, type, points: 10 };
    });

    const placeholders = buildFallback();
    try {
      await AuditLog.create({
        userId: req.user?.id,
        action: 'ai_questions_generated_fallback',
        details: { count: placeholders.length, difficulty, type, subject, hasResume: !!resumeText },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch {}

    return res.json(createSuccessResponse('Questions generated successfully (fallback)', {
      questions: placeholders,
      metadata: { count: placeholders.length, difficulty, type, subject, generatedAt: new Date().toISOString(), fallback: true }
    }));
  }

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
    // Build a precise system + user prompt tailored to requested type
    const c = parseInt(count);
    const sys = 'You are an expert assessment generator. Always return STRICT JSON only, no commentary.';
    const baseReq = `Generate exactly ${c} ${type} questions for subject "${subject}" with ${difficulty} difficulty.`;
    let reqSpec = '';
    if (type === 'multiple_choice') {
      reqSpec = `Each item must include: "question" (string), "options" (array of 4 strings without leading labels), "correctAnswer" (one of "A","B","C","D"), "explanation" (string), "difficulty" ("easy"|"medium"|"hard"), "type": "multiple_choice", and optional "points" (number).`;
    } else if (type === 'essay') {
      reqSpec = `Each item must include: "question" (string), "explanation" (string with expected output or key points), "difficulty", "type": "essay", and optional "points" (number).`;
    } else if (type === 'coding') {
      reqSpec = `Each item must include: "question" (string), optional "starterCode" (string), "tests" (array of objects with "input" and "expected"), "explanation" (string), "difficulty", "type": "coding", and optional "points" (number).`;
    } else {
      reqSpec = `Return structured items with fields relevant to the question type and include a "type" field.`;
    }

    const finalPrompt = `${prompt}\n\n${baseReq}\n${reqSpec}\nReturn a JSON array only.`.slice(0, 1800); // safety cap

    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: finalPrompt }
    ];

    const resp = await aiService.chatCompletion(messages, { max_tokens: 1800, temperature: 0.3 });
    const text = resp?.choices?.[0]?.message?.content || '[]';
    // Reuse parser from service
    const questions = aiService.parseQuestions(text);

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
    // Fallback: generate simple placeholder items to keep UI flowing
    try {
      const c = parseInt(count) || 5;
      const placeholders = Array.from({ length: c }).map((_, i) => {
        if (type === 'multiple_choice') {
          return {
            question: `(${subject}) Placeholder MCQ #${i + 1}: What is true about ${subject}?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 'A',
            explanation: `Basic ${subject} knowledge.`,
            difficulty,
            type: 'multiple_choice',
            points: 10
          };
        } else if (type === 'essay') {
          return {
            question: `(${subject}) Output-based #${i + 1}: Provide the expected output for the given scenario.`,
            explanation: `Key points about ${subject} output.`,
            difficulty,
            type: 'essay',
            points: 10
          };
        } else if (type === 'coding') {
          return {
            question: `(${subject}) Practical #${i + 1}: Implement a function related to ${subject}.`,
            starterCode: `function solve(input) {\n  // TODO: implement\n  return null;\n}`,
            tests: [
              { input: 'sample', expected: 'expected' }
            ],
            explanation: `Write clean code and handle edge-cases.`,
            difficulty,
            type: 'coding',
            points: 10
          };
        }
        return { question: `Placeholder Question #${i + 1}`, explanation: 'N/A', difficulty, type, points: 10 };
      });

      try {
        await AuditLog.create({
          userId: req.user?.id,
          action: 'ai_questions_generated_fallback',
          details: { count: placeholders.length, difficulty, type, subject, hasResume: !!resumeText },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (auditErr) {
        logger.warn('AuditLog fallback insert failed:', auditErr?.message);
      }

      return res.json(createSuccessResponse('Questions generated successfully (fallback)', {
        questions: placeholders,
        metadata: { count: placeholders.length, difficulty, type, subject, generatedAt: new Date().toISOString(), fallback: true }
      }));
    } catch (fallbackErr) {
      logger.error('Fallback generation failed:', fallbackErr);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        createErrorResponse('Failed to generate questions. Please try again.')
      );
    }
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

    const analysis = await aiService.analyzeResume(resumeText);

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
    const suggestions = await aiService.generateTestSuggestions(skills, experience, role);

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
