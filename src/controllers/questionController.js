const Question = require('../models/Question');
const { validationResult } = require('express-validator');

// @desc    Get all questions with domain-based filtering
// @route   GET /api/questions
// @access  Super Admin, Company Admin
const getQuestions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      domain = '',
      subDomain = '',
      difficulty = '',
      type = '',
      isPublic = '',
      tags = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    // Role-based filtering
    if (req.user.role === 'company' || req.user.role === 'admin') {
      filter.$or = [
        { isPublic: true },
        { companyId: req.user.companyId || req.user.id }
      ];
    }
    
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: 'i' } },
        { explanation: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (domain) filter.domain = domain;
    if (subDomain) filter.subDomain = subDomain;
    if (difficulty) filter.difficulty = difficulty;
    if (type) filter.type = type;
    if (isPublic !== '') filter.isPublic = isPublic === 'true';
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [questions, totalCount] = await Promise.all([
      Question.find(filter)
        .populate('createdBy', 'firstName lastName email')
        .populate('companyId', 'companyName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Question.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching questions',
      error: error.message
    });
  }
};

// @desc    Get questions grouped by domain
// @route   GET /api/questions/domains
// @access  Super Admin, Company Admin
const getQuestionsByDomain = async (req, res) => {
  try {
    const filter = { isActive: true };
    
    // Role-based filtering
    if (req.user.role === 'company' || req.user.role === 'admin') {
      filter.$or = [
        { isPublic: true },
        { companyId: req.user.companyId || req.user.id }
      ];
    }

    const domainStats = await Question.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$domain',
          totalQuestions: { $sum: 1 },
          difficulties: {
            $push: '$difficulty'
          },
          types: {
            $push: '$type'
          },
          avgUsage: { $avg: '$usageCount' },
          avgScore: { $avg: '$averageScore' }
        }
      },
      {
        $addFields: {
          difficultyBreakdown: {
            easy: {
              $size: {
                $filter: {
                  input: '$difficulties',
                  cond: { $eq: ['$$this', 'easy'] }
                }
              }
            },
            medium: {
              $size: {
                $filter: {
                  input: '$difficulties',
                  cond: { $eq: ['$$this', 'medium'] }
                }
              }
            },
            hard: {
              $size: {
                $filter: {
                  input: '$difficulties',
                  cond: { $eq: ['$$this', 'hard'] }
                }
              }
            }
          },
          typeBreakdown: {
            'multiple-choice': {
              $size: {
                $filter: {
                  input: '$types',
                  cond: { $eq: ['$$this', 'multiple-choice'] }
                }
              }
            },
            coding: {
              $size: {
                $filter: {
                  input: '$types',
                  cond: { $eq: ['$$this', 'coding'] }
                }
              }
            },
            essay: {
              $size: {
                $filter: {
                  input: '$types',
                  cond: { $eq: ['$$this', 'essay'] }
                }
              }
            },
            'true-false': {
              $size: {
                $filter: {
                  input: '$types',
                  cond: { $eq: ['$$this', 'true-false'] }
                }
              }
            }
          }
        }
      },
      { $sort: { totalQuestions: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: domainStats
    });
  } catch (error) {
    console.error('Error fetching domain statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching domain statistics',
      error: error.message
    });
  }
};

// @desc    Get single question by ID
// @route   GET /api/questions/:id
// @access  Super Admin, Company Admin
const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('companyId', 'companyName')
      .lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check access permissions
    if (req.user.role !== 'super-admin') {
      if (!question.isPublic && question.companyId?.toString() !== (req.user.companyId || req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching question',
      error: error.message
    });
  }
};

// @desc    Create new question
// @route   POST /api/questions
// @access  Super Admin, Company Admin
const createQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      question,
      type,
      domain,
      subDomain,
      difficulty,
      points,
      options,
      correctAnswer,
      explanation,
      codeTemplate,
      testCases,
      tags,
      isPublic = false
    } = req.body;

    // Set company ID for non-super-admin users
    let companyId = null;
    if (req.user.role !== 'super-admin') {
      companyId = req.user.companyId || req.user.id;
    }

    const newQuestion = new Question({
      question,
      type,
      domain,
      subDomain,
      difficulty,
      points,
      options,
      correctAnswer,
      explanation,
      codeTemplate,
      testCases,
      tags,
      isPublic: req.user.role === 'super-admin' ? isPublic : false, // Only super admin can create public questions
      companyId,
      createdBy: req.user.id
    });

    await newQuestion.save();

    const populatedQuestion = await Question.findById(newQuestion._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('companyId', 'companyName');

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: populatedQuestion
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating question',
      error: error.message
    });
  }
};

// @desc    Update question
// @route   PUT /api/questions/:id
// @access  Super Admin, Company Admin (own questions only)
const updateQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'super-admin') {
      if (question.companyId?.toString() !== (req.user.companyId || req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Store previous version
    if (question.version) {
      question.previousVersions.push({
        version: question.version,
        question: question.question,
        updatedAt: new Date(),
        updatedBy: req.user.id
      });
    }

    // Update fields
    const updateFields = [
      'question', 'type', 'domain', 'subDomain', 'difficulty', 'points',
      'options', 'correctAnswer', 'explanation', 'codeTemplate', 'testCases', 'tags'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        question[field] = req.body[field];
      }
    });

    // Only super admin can change public status
    if (req.user.role === 'super-admin' && req.body.isPublic !== undefined) {
      question.isPublic = req.body.isPublic;
    }

    question.version += 1;
    await question.save();

    const updatedQuestion = await Question.findById(question._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('companyId', 'companyName');

    res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      data: updatedQuestion
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating question',
      error: error.message
    });
  }
};

// @desc    Delete question (soft delete)
// @route   DELETE /api/questions/:id
// @access  Super Admin, Company Admin (own questions only)
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'super-admin') {
      if (question.companyId?.toString() !== (req.user.companyId || req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Soft delete
    question.isActive = false;
    await question.save();

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting question',
      error: error.message
    });
  }
};

// @desc    Bulk import questions from CSV/JSON
// @route   POST /api/questions/bulk-import
// @access  Super Admin, Company Admin
const bulkImportQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: 'Questions array is required'
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < questions.length; i++) {
      try {
        const questionData = questions[i];
        
        // Set company ID for non-super-admin users
        let companyId = null;
        if (req.user.role !== 'super-admin') {
          companyId = req.user.companyId || req.user.id;
        }

        const question = new Question({
          ...questionData,
          companyId,
          createdBy: req.user.id,
          isPublic: req.user.role === 'super-admin' ? questionData.isPublic : false
        });

        await question.save();
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          question: questions[i].question?.substring(0, 50) + '...',
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk import completed. ${results.success} questions imported, ${results.failed} failed.`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({
      success: false,
      message: 'Error in bulk import',
      error: error.message
    });
  }
};

// @desc    Get question analytics
// @route   GET /api/questions/analytics
// @access  Super Admin, Company Admin
const getQuestionAnalytics = async (req, res) => {
  try {
    const filter = { isActive: true };
    
    // Role-based filtering
    if (req.user.role !== 'super-admin') {
      filter.$or = [
        { isPublic: true },
        { companyId: req.user.companyId || req.user.id }
      ];
    }

    const [
      totalQuestions,
      domainDistribution,
      difficultyDistribution,
      typeDistribution,
      usageStats,
      topPerformingQuestions
    ] = await Promise.all([
      Question.countDocuments(filter),
      Question.aggregate([
        { $match: filter },
        { $group: { _id: '$domain', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Question.aggregate([
        { $match: filter },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } }
      ]),
      Question.aggregate([
        { $match: filter },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      Question.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalUsage: { $sum: '$usageCount' },
            avgUsage: { $avg: '$usageCount' },
            avgScore: { $avg: '$averageScore' }
          }
        }
      ]),
      Question.find(filter)
        .sort({ usageCount: -1, averageScore: -1 })
        .limit(10)
        .select('question domain difficulty usageCount averageScore')
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalQuestions,
          totalUsage: usageStats[0]?.totalUsage || 0,
          averageUsage: Math.round(usageStats[0]?.avgUsage || 0),
          averageScore: Math.round(usageStats[0]?.avgScore || 0)
        },
        distribution: {
          byDomain: domainDistribution,
          byDifficulty: difficultyDistribution,
          byType: typeDistribution
        },
        topPerforming: topPerformingQuestions
      }
    });
  } catch (error) {
    console.error('Error fetching question analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

module.exports = {
  getQuestions,
  getQuestionsByDomain,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
  getQuestionAnalytics
};
