const Test = require('../models/Test');
const TestAttempt = require('../models/TestAttempt');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { asyncHandler } = require('../middleware/errorHandler');
const { HTTP_STATUS } = require('../utils/constants');
const { createSuccessResponse, createErrorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  const ranges = {
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  };
  return ranges[period] || ranges['30d'];
};

// @desc    Get dashboard analytics
// @route   GET /api/reports/dashboard
// @access  Private
const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  const startDate = getDateRange(period);
  const userId = req.user.id;
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

  // Base query - admins see all data, users see only their own
  const userQuery = isAdmin ? {} : { userId };
  const testQuery = isAdmin ? {} : { createdBy: userId };

  // Get test statistics
  const testStats = await Test.aggregate([
    { $match: { ...testQuery, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalTests: { $sum: 1 },
        publishedTests: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        draftTests: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } }
      }
    }
  ]);

  // Get attempt statistics
  const attemptStats = await TestAttempt.aggregate([
    { $match: { ...userQuery, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        completedAttempts: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        averageScore: { $avg: '$percentage' },
        totalTimeSpent: { $sum: '$timeSpent' }
      }
    }
  ]);

  // Get recent activity
  const recentAttempts = await TestAttempt.find({
    ...userQuery,
    createdAt: { $gte: startDate }
  })
    .populate('testId', 'title')
    .populate('userId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('testId userId score percentage status createdAt');

  // Get performance trends (daily data for charts)
  const performanceTrends = await TestAttempt.aggregate([
    { $match: { ...userQuery, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        attempts: { $sum: 1 },
        averageScore: { $avg: '$percentage' }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  res.json(
    createSuccessResponse('Dashboard analytics retrieved successfully', {
      period,
      testStats: testStats[0] || { totalTests: 0, publishedTests: 0, draftTests: 0 },
      attemptStats: attemptStats[0] || { 
        totalAttempts: 0, 
        completedAttempts: 0, 
        averageScore: 0, 
        totalTimeSpent: 0 
      },
      recentAttempts,
      performanceTrends: performanceTrends.map(trend => ({
        date: trend._id.date,
        attempts: trend.attempts,
        averageScore: Math.round(trend.averageScore || 0)
      }))
    })
  );
});

// @desc    Get test analytics
// @route   GET /api/reports/test/:id
// @access  Private
const getTestAnalytics = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  const startDate = getDateRange(period);
  const testId = req.params.id;

  const test = await Test.findById(testId);
  if (!test) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('Test not found')
    );
  }

  // Check access permissions
  if (req.user.role !== 'super_admin' && 
      req.user.role !== 'admin' && 
      test.createdBy.toString() !== req.user.id) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      createErrorResponse('Access denied')
    );
  }

  // Get attempt statistics
  const attemptStats = await TestAttempt.aggregate([
    { 
      $match: { 
        testId: test._id, 
        createdAt: { $gte: startDate } 
      } 
    },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        completedAttempts: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        averageScore: { $avg: '$percentage' },
        highestScore: { $max: '$percentage' },
        lowestScore: { $min: '$percentage' },
        averageTimeSpent: { $avg: '$timeSpent' },
        passRate: { 
          $avg: { 
            $cond: [{ $gte: ['$percentage', test.passingScore] }, 1, 0] 
          } 
        }
      }
    }
  ]);

  // Get score distribution
  const scoreDistribution = await TestAttempt.aggregate([
    { 
      $match: { 
        testId: test._id, 
        status: 'completed',
        createdAt: { $gte: startDate } 
      } 
    },
    {
      $bucket: {
        groupBy: '$percentage',
        boundaries: [0, 20, 40, 60, 80, 100],
        default: 'Other',
        output: {
          count: { $sum: 1 },
          averageScore: { $avg: '$percentage' }
        }
      }
    }
  ]);

  // Get recent attempts
  const recentAttempts = await TestAttempt.find({
    testId: test._id,
    createdAt: { $gte: startDate }
  })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(20)
    .select('userId score percentage status timeSpent createdAt');

  res.json(
    createSuccessResponse('Test analytics retrieved successfully', {
      test: {
        id: test._id,
        title: test.title,
        passingScore: test.passingScore
      },
      period,
      stats: attemptStats[0] || {
        totalAttempts: 0,
        completedAttempts: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        averageTimeSpent: 0,
        passRate: 0
      },
      scoreDistribution,
      recentAttempts
    })
  );
});

// @desc    Get user performance report
// @route   GET /api/reports/user/:id/performance
// @access  Private
const getUserPerformance = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  const startDate = getDateRange(period);
  const userId = req.params.id;

  // Check access permissions
  if (req.user.role !== 'super_admin' && 
      req.user.role !== 'admin' && 
      req.user.id !== userId) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      createErrorResponse('Access denied')
    );
  }

  const user = await User.findById(userId).select('-password -refreshToken');
  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('User not found')
    );
  }

  // Get performance statistics
  const performanceStats = await TestAttempt.aggregate([
    { 
      $match: { 
        userId: user._id, 
        createdAt: { $gte: startDate } 
      } 
    },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        completedAttempts: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        averageScore: { $avg: '$percentage' },
        highestScore: { $max: '$percentage' },
        totalTimeSpent: { $sum: '$timeSpent' },
        improvementTrend: { $avg: '$percentage' }
      }
    }
  ]);

  // Get test results by category
  const testResults = await TestAttempt.find({
    userId: user._id,
    status: 'completed',
    createdAt: { $gte: startDate }
  })
    .populate('testId', 'title type category')
    .sort({ createdAt: -1 })
    .select('testId score percentage timeSpent createdAt');

  // Get performance trends over time
  const performanceTrends = await TestAttempt.aggregate([
    { 
      $match: { 
        userId: user._id, 
        status: 'completed',
        createdAt: { $gte: startDate } 
      } 
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        averageScore: { $avg: '$percentage' },
        attempts: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  res.json(
    createSuccessResponse('User performance retrieved successfully', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      period,
      stats: performanceStats[0] || {
        totalAttempts: 0,
        completedAttempts: 0,
        averageScore: 0,
        highestScore: 0,
        totalTimeSpent: 0
      },
      testResults,
      performanceTrends: performanceTrends.map(trend => ({
        date: trend._id.date,
        averageScore: Math.round(trend.averageScore || 0),
        attempts: trend.attempts
      }))
    })
  );
});

// @desc    Get system analytics (Admin only)
// @route   GET /api/reports/system
// @access  Private (Admin only)
const getSystemAnalytics = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  const startDate = getDateRange(period);

  // Get user statistics
  const userStats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
        adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
        newUsers: {
          $sum: {
            $cond: [{ $gte: ['$createdAt', startDate] }, 1, 0]
          }
        }
      }
    }
  ]);

  // Get test statistics
  const testStats = await Test.aggregate([
    {
      $group: {
        _id: null,
        totalTests: { $sum: 1 },
        publishedTests: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        newTests: {
          $sum: {
            $cond: [{ $gte: ['$createdAt', startDate] }, 1, 0]
          }
        }
      }
    }
  ]);

  // Get attempt statistics
  const attemptStats = await TestAttempt.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        completedAttempts: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        averageScore: { $avg: '$percentage' }
      }
    }
  ]);

  // Get activity trends
  const activityTrends = await AuditLog.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          action: '$action'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  res.json(
    createSuccessResponse('System analytics retrieved successfully', {
      period,
      userStats: userStats[0] || { totalUsers: 0, activeUsers: 0, adminUsers: 0, newUsers: 0 },
      testStats: testStats[0] || { totalTests: 0, publishedTests: 0, newTests: 0 },
      attemptStats: attemptStats[0] || { totalAttempts: 0, completedAttempts: 0, averageScore: 0 },
      activityTrends
    })
  );
});

// @desc    Export test results
// @route   GET /api/reports/test/:id/export
// @access  Private
const exportTestResults = asyncHandler(async (req, res) => {
  const { format = 'csv' } = req.query;
  const testId = req.params.id;

  const test = await Test.findById(testId);
  if (!test) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('Test not found')
    );
  }

  // Check access permissions
  if (req.user.role !== 'super_admin' && 
      req.user.role !== 'admin' && 
      test.createdBy.toString() !== req.user.id) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      createErrorResponse('Access denied')
    );
  }

  // Get test results
  const results = await TestAttempt.find({ testId: test._id, status: 'completed' })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 });

  if (format === 'csv') {
    const csvHeader = 'Name,Email,Score,Percentage,Time Spent,Date\n';
    const csvData = results.map(result => {
      const name = `${result.userId.firstName} ${result.userId.lastName}`;
      const email = result.userId.email;
      const score = result.score;
      const percentage = result.percentage;
      const timeSpent = Math.round(result.timeSpent / 60); // Convert to minutes
      const date = result.createdAt.toISOString().split('T')[0];
      return `"${name}","${email}",${score},${percentage},${timeSpent},"${date}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${test.title}-results.csv"`);
    res.send(csvHeader + csvData);
  } else {
    // For now, return JSON format for PDF generation on frontend
    res.json(
      createSuccessResponse('Test results exported successfully', {
        test: {
          id: test._id,
          title: test.title,
          description: test.description
        },
        results: results.map(result => ({
          name: `${result.userId.firstName} ${result.userId.lastName}`,
          email: result.userId.email,
          score: result.score,
          percentage: result.percentage,
          timeSpent: result.timeSpent,
          date: result.createdAt
        }))
      })
    );
  }

  await AuditLog.create({
    userId: req.user.id,
    action: 'test_results_exported',
    resourceType: 'Test',
    resourceId: test._id,
    details: { format, testTitle: test.title },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`Test results exported: ${test.title} by ${req.user.email}`);
});

module.exports = {
  getDashboardAnalytics,
  getTestAnalytics,
  getUserPerformance,
  getSystemAnalytics,
  exportTestResults
};
