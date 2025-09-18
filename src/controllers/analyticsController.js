const Company = require('../models/Company');
const Question = require('../models/Question');
const Test = require('../models/Test');
const TestResult = require('../models/TestResult');
const TestAttempt = require('../models/TestAttempt');
const Candidate = require('../models/Candidate');
const Billing = require('../models/Billing');
const User = require('../models/User');
const Interview = require('../models/Interview');
const cache = require('../utils/cache');

// @desc    Get dashboard analytics for Super Admin
// @route   GET /api/analytics/dashboard
// @access  Super Admin only
const getDashboardAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Date range filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get overview statistics
    const [
      totalCompanies,
      activeCompanies,
      totalCandidates,
      totalTests,
      totalQuestions,
      totalRevenue,
      recentActivity,
      proctoringCounts,
      topFlaggedAttempts
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ status: 'active' }),
      Candidate.countDocuments(),
      TestResult.countDocuments(),
      Question.countDocuments({ isActive: true }),
      Billing.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      TestResult.find(dateFilter)
        .populate('candidateId', 'name email')
        .populate('testId', 'testName')
        .populate('companyId', 'companyName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      TestAttempt.countDocuments({
        ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
        'flags.suspicious': true
      }),
      TestAttempt.find({
        ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
      })
        .sort({ 'flags.tabSwitches': -1, 'flags.fullscreenExits': -1, 'flags.copyPasteAttempts': -1 })
        .limit(10)
        .populate('testId', 'title')
        .lean()
    ]);

    // Company activity over time
    const companyGrowth = await Company.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    // Test completion rates by domain
    const domainPerformance = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      {
        $lookup: {
          from: 'questions',
          localField: 'test.questions',
          foreignField: '_id',
          as: 'questions'
        }
      },
      { $unwind: '$questions' },
      {
        $group: {
          _id: '$questions.domain',
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$percentage' },
          passCount: {
            $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          passRate: {
            $multiply: [
              { $divide: ['$passCount', '$totalAttempts'] },
              100
            ]
          }
        }
      },
      { $sort: { totalAttempts: -1 } },
      { $limit: 10 }
    ]);

    // Revenue trends
    const revenueByMonth = await Billing.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: {
            year: { $year: '$paidDate' },
            month: { $month: '$paidDate' }
          },
          revenue: { $sum: '$amount' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    // Geographic distribution
    const geographicData = await Company.aggregate([
      {
        $group: {
          _id: '$address.country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Industry distribution
    const industryDistribution = await Company.aggregate([
      {
        $group: {
          _id: '$industry',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCompanies,
          activeCompanies,
          totalCandidates,
          totalTests,
          totalQuestions,
          totalRevenue: totalRevenue[0]?.total || 0,
          growthRate: companyGrowth.length > 1 ? 
            ((companyGrowth[companyGrowth.length - 1].count - companyGrowth[0].count) / companyGrowth[0].count * 100).toFixed(2) : 0
        },
        charts: {
          companyGrowth: companyGrowth.map(item => ({
            period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            count: item.count
          })),
          domainPerformance,
          revenueByMonth: revenueByMonth.map(item => ({
            period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            revenue: item.revenue,
            invoiceCount: item.invoiceCount
          })),
          geographicData,
          industryDistribution
        },
        recentActivity,
        proctoring: {
          suspiciousAttempts: proctoringCounts,
          topFlaggedAttempts: topFlaggedAttempts.map(a => ({
            attemptId: a._id,
            testTitle: a.testId?.title || 'Unknown Test',
            tabSwitches: a.flags?.tabSwitches || 0,
            fullscreenExits: a.flags?.fullscreenExits || 0,
            copyPasteAttempts: a.flags?.copyPasteAttempts || 0,
            totalWarnings: (a.flags?.tabSwitches || 0) + (a.flags?.fullscreenExits || 0) + (a.flags?.copyPasteAttempts || 0),
            createdAt: a.createdAt
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard analytics',
      error: error.message
    });
  }
};

// @desc    Get company-specific analytics
// @route   GET /api/analytics/company/:id
// @access  Super Admin, Company Admin
const getCompanyAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Check permissions
    if (req.user.role !== 'super-admin' && (req.user.companyId || req.user.id) !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const dateFilter = { companyId: id };
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const [
      company,
      candidateStats,
      testStats,
      performanceStats,
      recentResults
    ] = await Promise.all([
      Company.findById(id).lean(),
      Candidate.aggregate([
        { $match: { companyId: id } },
        {
          $group: {
            _id: null,
            totalCandidates: { $sum: 1 },
            activeCandidates: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            avgScore: { $avg: '$averageScore' }
          }
        }
      ]),
      TestResult.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalTests: { $sum: 1 },
            passedTests: {
              $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] }
            },
            avgScore: { $avg: '$percentage' },
            avgTimeTaken: { $avg: '$timeTaken' }
          }
        }
      ]),
      TestResult.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: 'tests',
            localField: 'testId',
            foreignField: '_id',
            as: 'test'
          }
        },
        { $unwind: '$test' },
        {
          $lookup: {
            from: 'questions',
            localField: 'test.questions',
            foreignField: '_id',
            as: 'questions'
          }
        },
        { $unwind: '$questions' },
        {
          $group: {
            _id: '$questions.domain',
            avgScore: { $avg: '$percentage' },
            testCount: { $sum: 1 }
          }
        },
        { $sort: { testCount: -1 } }
      ]),
      TestResult.find(dateFilter)
        .populate('candidateId', 'name email')
        .populate('testId', 'testName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Test completion trends
    const completionTrends = await TestResult.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          avgScore: { $avg: '$percentage' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      { $limit: 30 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        company,
        overview: {
          totalCandidates: candidateStats[0]?.totalCandidates || 0,
          activeCandidates: candidateStats[0]?.activeCandidates || 0,
          totalTests: testStats[0]?.totalTests || 0,
          passRate: testStats[0] ? 
            ((testStats[0].passedTests / testStats[0].totalTests) * 100).toFixed(2) : 0,
          avgScore: Math.round(testStats[0]?.avgScore || 0),
          avgTimeTaken: Math.round(testStats[0]?.avgTimeTaken || 0)
        },
        charts: {
          completionTrends: completionTrends.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            count: item.count,
            avgScore: Math.round(item.avgScore)
          })),
          domainPerformance: performanceStats
        },
        recentResults
      }
    });
  } catch (error) {
    console.error('Error fetching company analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company analytics',
      error: error.message
    });
  }
};

// @desc    Get test analytics
// @route   GET /api/analytics/test/:id
// @access  Super Admin, Company Admin
const getTestAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const [test, analytics] = await Promise.all([
      Test.findById(id)
        .populate('questions')
        .populate('createdBy', 'firstName lastName')
        .lean(),
      TestResult.getTestAnalytics(id)
    ]);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'super-admin' && test.companyId?.toString() !== (req.user.companyId || req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Question-wise performance
    const questionPerformance = await TestResult.aggregate([
      { $match: { testId: test._id } },
      { $unwind: '$answers' },
      {
        $group: {
          _id: '$answers.questionId',
          totalAttempts: { $sum: 1 },
          correctAttempts: {
            $sum: { $cond: ['$answers.isCorrect', 1, 0] }
          },
          avgTimeSpent: { $avg: '$answers.timeSpent' },
          avgPointsEarned: { $avg: '$answers.pointsEarned' }
        }
      },
      {
        $lookup: {
          from: 'questions',
          localField: '_id',
          foreignField: '_id',
          as: 'question'
        }
      },
      { $unwind: '$question' },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$correctAttempts', '$totalAttempts'] },
              100
            ]
          }
        }
      },
      { $sort: { successRate: 1 } }
    ]);

    // Score distribution
    const scoreDistribution = await TestResult.aggregate([
      { $match: { testId: test._id } },
      {
        $bucket: {
          groupBy: '$percentage',
          boundaries: [0, 20, 40, 60, 80, 100],
          default: 'Other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        test,
        analytics: analytics[0] || {
          totalAttempts: 0,
          averageScore: 0,
          passCount: 0,
          failCount: 0,
          passRate: 0,
          averageTimeTaken: 0,
          highestScore: 0,
          lowestScore: 0
        },
        questionPerformance,
        scoreDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching test analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching test analytics',
      error: error.message
    });
  }
};

// @desc    Get system performance metrics
// @route   GET /api/analytics/system
// @access  Super Admin only
const getSystemMetrics = async (req, res) => {
  try {
    const [
      userStats,
      systemLoad,
      databaseStats,
      errorRates
    ] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            activeCount: {
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            lastLogin: { $max: '$lastLogin' }
          }
        }
      ]),
      // Simulated system metrics - in production, you'd get these from monitoring tools
      Promise.resolve({
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        activeConnections: Math.floor(Math.random() * 1000)
      }),
      // Database collection stats
      Promise.all([
        Company.countDocuments(),
        Question.countDocuments(),
        Test.countDocuments(),
        TestResult.countDocuments(),
        Candidate.countDocuments(),
        Billing.countDocuments()
      ]).then(([companies, questions, tests, results, candidates, billing]) => ({
        companies,
        questions,
        tests,
        results,
        candidates,
        billing,
        total: companies + questions + tests + results + candidates + billing
      })),
      // Simulated error rates
      Promise.resolve({
        last24h: Math.floor(Math.random() * 50),
        last7d: Math.floor(Math.random() * 200),
        last30d: Math.floor(Math.random() * 500)
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: userStats,
        system: systemLoad,
        database: databaseStats,
        errors: errorRates,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system metrics',
      error: error.message
    });
  }
};

// @desc    Export analytics data
// @route   GET /api/analytics/export
// @access  Super Admin, Company Admin
const exportAnalytics = async (req, res) => {
  try {
    const { type, format = 'json', startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    let data = {};

    switch (type) {
      case 'companies':
        if (req.user.role !== 'super-admin') {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
        data = await Company.find(dateFilter).lean();
        break;

      case 'test-results':
        const filter = { ...dateFilter };
        if (req.user.role !== 'super-admin') {
          filter.companyId = req.user.companyId || req.user.id;
        }
        data = await TestResult.find(filter)
          .populate('candidateId', 'name email')
          .populate('testId', 'testName')
          .lean();
        break;

      case 'candidates':
        const candidateFilter = { ...dateFilter };
        if (req.user.role !== 'super-admin') {
          candidateFilter.companyId = req.user.companyId || req.user.id;
        }
        data = await Candidate.find(candidateFilter).lean();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-export.csv"`);
      return res.send(csv);
    }

    res.status(200).json({
      success: true,
      data,
      exportedAt: new Date(),
      recordCount: data.length
    });
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting analytics',
      error: error.message
    });
  }
};

// Helper function to convert JSON to CSV
const convertToCSV = (data) => {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value}"` : value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

module.exports = {
  getDashboardAnalytics,
  getCompanyAnalytics,
  getTestAnalytics,
  getSystemMetrics,
  exportAnalytics
};

// --- Lightweight KPI endpoints for dashboard cards ---
// @desc    Admin KPI summary for dashboard cards
// @route   GET /api/analytics/kpi/admin
// @access  super_admin, admin
const getAdminKpis = async (req, res) => {
  try {
    const cacheKey = 'kpi:admin';
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const [totalTests, activeTests, totalUsers] = await Promise.all([
      Test.countDocuments(),
      Test.countDocuments({ status: { $in: ['active', 'published'] } }),
      User.countDocuments()
    ]);

    const response = {
      success: true,
      data: {
        totalTests,
        activeTests,
        totalUsers,
        systemHealth: 'Good'
      }
    };

    cache.set(cacheKey, response, 60);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load admin KPIs', error: error.message });
  }
};

// @desc    Company KPI summary for dashboard cards
// @route   GET /api/analytics/kpi/company
// @access  company, admin
const getCompanyKpis = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    const cacheKey = `kpi:company:${companyId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const now = new Date();
    const next7d = new Date(now);
    next7d.setDate(next7d.getDate() + 7);

    const [activeTests, candidatesToday, recentResultsAgg, upcomingInterviews] = await Promise.all([
      Test.countDocuments({ companyId, status: { $in: ['active', 'published'] } }),
      Candidate.countDocuments({ companyId, createdAt: { $gte: since } }),
      TestResult.aggregate([
        { $match: { companyId } },
        { $group: { _id: null, total: { $sum: 1 }, passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } } } }
      ]),
      Interview.countDocuments({
        companyId,
        scheduledDate: { $gte: now, $lte: next7d },
        status: { $in: ['scheduled', 'rescheduled', 'in-progress'] }
      })
    ]);

    const total = recentResultsAgg?.[0]?.total || 0;
    const passed = recentResultsAgg?.[0]?.passed || 0;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const response = {
      success: true,
      data: {
        activeTests,
        candidatesToday,
        successRate,
        upcomingInterviews
      }
    };

    cache.set(cacheKey, response, 60);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load company KPIs', error: error.message });
  }
};

module.exports.getAdminKpis = getAdminKpis;
module.exports.getCompanyKpis = getCompanyKpis;
