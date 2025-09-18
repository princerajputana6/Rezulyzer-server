const Test = require('../models/Test');
const Question = require('../models/Question');
const { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../utils/constants');
const { formatResponse } = require('../utils/helpers');
const { validationResult } = require('express-validator');

// @desc    Get all tests with filtering and pagination
// @route   GET /api/test-library
// @access  Private (Admin, Super Admin)
const getTests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      difficulty,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Role-based filtering
    if (req.user.role !== 'super_admin') {
      filter.createdBy = req.user.id;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    if (status) filter.status = status;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query with population
    const tests = await Test.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .populate('questions', 'question type domain difficulty points')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Test.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Calculate statistics
    const stats = await Test.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTests: { $sum: 1 },
          publishedTests: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          draftTests: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          avgDuration: { $avg: '$duration' },
          avgQuestions: { $avg: '$totalQuestions' }
        }
      }
    ]);

    res.json(formatResponse(true, 'Tests retrieved successfully', {
      tests,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      statistics: stats[0] || {
        totalTests: 0,
        publishedTests: 0,
        draftTests: 0,
        avgDuration: 0,
        avgQuestions: 0
      }
    }));
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Get single test by ID
// @route   GET /api/test-library/:id
// @access  Private (Admin, Super Admin)
const getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate({
        path: 'questions',
        select: 'question type domain subDomain difficulty points options correctAnswer explanation tags'
      });

    if (!test) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Test not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && test.createdBy._id.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied')
      );
    }

    res.json(formatResponse(true, 'Test retrieved successfully', { test }));
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Create new test
// @route   POST /api/test-library
// @access  Private (Admin, Super Admin)
const createTest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Validation error', { errors: errors.array() })
      );
    }

    const {
      title,
      description,
      type,
      difficulty,
      duration,
      passingScore,
      instructions,
      tags,
      settings,
      questions = []
    } = req.body;

    // Validate questions exist
    if (questions.length > 0) {
      const validQuestions = await Question.find({ _id: { $in: questions } });
      if (validQuestions.length !== questions.length) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          formatResponse(false, 'One or more questions not found')
        );
      }
    }

    const test = new Test({
      title,
      description,
      type,
      difficulty,
      duration,
      passingScore,
      instructions,
      tags: tags || [],
      settings: {
        shuffleQuestions: settings?.shuffleQuestions || false,
        showResults: settings?.showResults || true,
        allowReview: settings?.allowReview || false,
        timeLimit: settings?.timeLimit || duration,
        attemptsAllowed: settings?.attemptsAllowed || 1,
        proctoring: settings?.proctoring || {
          enabled: false,
          strictMode: false,
          allowCopyPaste: true,
          detectTabSwitch: false,
          requireWebcam: false
        }
      },
      questions,
      totalQuestions: questions.length,
      createdBy: req.user.id,
      status: 'draft'
    });

    await test.save();

    // Populate the response
    await test.populate('createdBy', 'firstName lastName email');
    await test.populate('questions', 'question type domain difficulty points');

    res.status(HTTP_STATUS.CREATED).json(
      formatResponse(true, 'Test created successfully', { test })
    );
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Update test
// @route   PUT /api/test-library/:id
// @access  Private (Admin, Super Admin)
const updateTest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Validation error', { errors: errors.array() })
      );
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Test not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && test.createdBy.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied')
      );
    }

    const { questions, ...updateData } = req.body;

    // Validate questions if provided
    if (questions && questions.length > 0) {
      const validQuestions = await Question.find({ _id: { $in: questions } });
      if (validQuestions.length !== questions.length) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          formatResponse(false, 'One or more questions not found')
        );
      }
      updateData.questions = questions;
      updateData.totalQuestions = questions.length;
    }

    // Update test
    Object.assign(test, updateData);
    test.updatedAt = new Date();
    await test.save();

    // Populate the response
    await test.populate('createdBy', 'firstName lastName email');
    await test.populate('questions', 'question type domain difficulty points');

    res.json(formatResponse(true, 'Test updated successfully', { test }));
  } catch (error) {
    console.error('Error updating test:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Delete test
// @route   DELETE /api/test-library/:id
// @access  Private (Admin, Super Admin)
const deleteTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Test not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && test.createdBy.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied')
      );
    }

    await Test.findByIdAndDelete(req.params.id);

    res.json(formatResponse(true, 'Test deleted successfully'));
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Publish/Unpublish test
// @route   PATCH /api/test-library/:id/status
// @access  Private (Admin, Super Admin)
const updateTestStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Invalid status')
      );
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Test not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && test.createdBy.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied')
      );
    }

    // Validate test has questions before publishing
    if (status === 'published' && test.questions.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Cannot publish test without questions')
      );
    }

    test.status = status;
    test.updatedAt = new Date();
    await test.save();

    res.json(formatResponse(true, `Test ${status} successfully`, { test }));
  } catch (error) {
    console.error('Error updating test status:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Assign questions to test
// @route   POST /api/test-library/:id/questions
// @access  Private (Admin, Super Admin)
const assignQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Question IDs array is required')
      );
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Test not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && test.createdBy.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied')
      );
    }

    // Validate questions exist
    const validQuestions = await Question.find({ _id: { $in: questionIds } });
    if (validQuestions.length !== questionIds.length) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'One or more questions not found')
      );
    }

    // Update test with new questions
    test.questions = [...new Set([...test.questions, ...questionIds])]; // Remove duplicates
    test.totalQuestions = test.questions.length;
    test.updatedAt = new Date();
    await test.save();

    // Populate and return
    await test.populate('questions', 'question type domain difficulty points');

    res.json(formatResponse(true, 'Questions assigned successfully', { test }));
  } catch (error) {
    console.error('Error assigning questions:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Remove questions from test
// @route   DELETE /api/test-library/:id/questions
// @access  Private (Admin, Super Admin)
const removeQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        formatResponse(false, 'Question IDs array is required')
      );
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Test not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && test.createdBy.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied')
      );
    }

    // Remove questions
    test.questions = test.questions.filter(
      questionId => !questionIds.includes(questionId.toString())
    );
    test.totalQuestions = test.questions.length;
    test.updatedAt = new Date();
    await test.save();

    // Populate and return
    await test.populate('questions', 'question type domain difficulty points');

    res.json(formatResponse(true, 'Questions removed successfully', { test }));
  } catch (error) {
    console.error('Error removing questions:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

// @desc    Duplicate test
// @route   POST /api/test-library/:id/duplicate
// @access  Private (Admin, Super Admin)
const duplicateTest = async (req, res) => {
  try {
    const originalTest = await Test.findById(req.params.id);

    if (!originalTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        formatResponse(false, 'Test not found')
      );
    }

    // Check permissions
    if (req.user.role !== 'super_admin' && originalTest.createdBy.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        formatResponse(false, 'Access denied')
      );
    }

    // Create duplicate
    const duplicateData = originalTest.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    
    duplicateData.title = `${duplicateData.title} (Copy)`;
    duplicateData.status = 'draft';
    duplicateData.createdBy = req.user.id;

    const duplicateTest = new Test(duplicateData);
    await duplicateTest.save();

    // Populate the response
    await duplicateTest.populate('createdBy', 'firstName lastName email');
    await duplicateTest.populate('questions', 'question type domain difficulty points');

    res.status(HTTP_STATUS.CREATED).json(
      formatResponse(true, 'Test duplicated successfully', { test: duplicateTest })
    );
  } catch (error) {
    console.error('Error duplicating test:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      formatResponse(false, ERROR_MESSAGES.INTERNAL_ERROR)
    );
  }
};

module.exports = {
  getTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  updateTestStatus,
  assignQuestions,
  removeQuestions,
  duplicateTest
};
