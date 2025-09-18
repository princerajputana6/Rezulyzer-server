const Company = require('../models/Company');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const TestResult = require('../models/TestResult');
const Billing = require('../models/Billing');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail } = require('../services/emailService');
const { createSuccessResponse, createErrorResponse } = require('../utils/helpers');

// Generate system password
const generateSystemPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special
  
  // Fill remaining length
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// @desc    Get all companies with pagination and filters
// @route   GET /api/companies
// @access  Super Admin only
const getCompanies = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      industry = '',
      size = '',
      status = '',
      subscriptionStatus = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'contactPerson.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (industry) filter.industry = industry;
    if (size) filter.size = size;
    if (status) filter.status = status;
    if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [companies, totalCount] = await Promise.all([
      Company.find(filter)
        .populate('createdBy', 'firstName lastName email')
        .populate('totalCandidates')
        .populate('totalTests')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Company.countDocuments(filter)
    ]);

    // Add additional statistics for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const [candidateCount, testCount, totalSpent] = await Promise.all([
          Candidate.countDocuments({ companyId: company._id }),
          TestResult.countDocuments({ companyId: company._id }),
          Billing.aggregate([
            { $match: { companyId: company._id, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ])
        ]);

        return {
          ...company,
          statistics: {
            totalCandidates: candidateCount,
            totalTests: testCount,
            totalSpent: totalSpent[0]?.total || 0,
            creditsUsed: company.totalCreditsUsed || 0
          }
        };
      })
    );

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        companies: companiesWithStats,
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
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching companies',
      error: error.message
    });
  }
};

// @desc    Get single company by ID
// @route   GET /api/companies/:id
// @access  Super Admin only
const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Get detailed statistics
    const [
      candidateCount,
      activeTestsCount,
      completedTestsCount,
      totalSpent,
      recentBilling,
      topCandidates
    ] = await Promise.all([
      Candidate.countDocuments({ companyId: company._id }),
      TestResult.countDocuments({ companyId: company._id, status: 'in-progress' }),
      TestResult.countDocuments({ companyId: company._id, status: { $in: ['passed', 'failed'] } }),
      Billing.aggregate([
        { $match: { companyId: company._id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Billing.find({ companyId: company._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      TestResult.aggregate([
        { $match: { companyId: company._id } },
        { $group: { _id: '$candidateId', avgScore: { $avg: '$percentage' }, testCount: { $sum: 1 } } },
        { $sort: { avgScore: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'candidates', localField: '_id', foreignField: '_id', as: 'candidate' } },
        { $unwind: '$candidate' }
      ])
    ]);

    const companyWithDetails = {
      ...company,
      statistics: {
        totalCandidates: candidateCount,
        activeTests: activeTestsCount,
        completedTests: completedTestsCount,
        totalSpent: totalSpent[0]?.total || 0,
        creditsUsed: company.totalCreditsUsed || 0,
        creditsRemaining: company.creditsRemaining || 0
      },
      recentBilling,
      topPerformers: topCandidates
    };

    res.status(200).json({
      success: true,
      data: companyWithDetails
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company details',
      error: error.message
    });
  }
};

// @desc    Create new company
// @route   POST /api/companies
// @access  Super Admin only
const createCompany = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      companyName,
      email,
      industry,
      size,
      address,
      contactPerson,
      subscriptionPlan = 'basic',
      creditsRemaining = 100,
      billingInfo,
      settings
    } = req.body;

    // Check if company already exists
    const existingCompany = await Company.findOne({ email: email.toLowerCase() });
    if (existingCompany) {
      return res.status(400).json(
        createErrorResponse('Company with this email already exists')
      );
    }

    // Generate system password
    const systemPassword = generateSystemPassword();

    // Create company
    const company = new Company({
      companyName,
      email: email.toLowerCase(),
      password: systemPassword,
      industry,
      size,
      address,
      contactPerson,
      subscriptionPlan,
      creditsRemaining,
      billingInfo,
      settings,
      createdBy: req.user.id,
      status: 'active',
      subscriptionStatus: 'trial',
      isFirstLogin: true, // Flag for first-time login
      passwordResetRequired: true // Require password reset on first login
    });

    await company.save();

    // Send credentials via email
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to AI Test Portal - Your Login Credentials',
        template: 'company-credentials',
        data: {
          companyName,
          email,
          password: systemPassword,
          loginUrl: `${process.env.CLIENT_URL}/login`,
          contactPerson: contactPerson.name
        }
      });
    } catch (emailError) {
      console.error('Failed to send credentials email:', emailError);
      // Don't fail the company creation if email fails
    }

    // Remove password from response
    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.status(201).json(
      createSuccessResponse('Company created successfully. Login credentials sent via email.', {
        company: companyResponse,
        temporaryPassword: systemPassword // Show in popup for admin
      })
    );
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });
  }
};

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Super Admin only
const updateCompany = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const {
      companyName,
      email,
      industry,
      size,
      address,
      contactPerson,
      subscriptionPlan,
      subscriptionStatus,
      creditsRemaining,
      status,
      billingInfo,
      settings
    } = req.body;

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== company.email) {
      const existingCompany = await Company.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Update fields
    if (companyName) company.companyName = companyName;
    if (email) company.email = email.toLowerCase();
    if (industry) company.industry = industry;
    if (size) company.size = size;
    if (address) company.address = { ...company.address, ...address };
    if (contactPerson) company.contactPerson = { ...company.contactPerson, ...contactPerson };
    if (subscriptionPlan) company.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) company.subscriptionStatus = subscriptionStatus;
    if (creditsRemaining !== undefined) company.creditsRemaining = creditsRemaining;
    if (status) company.status = status;
    if (billingInfo) company.billingInfo = { ...company.billingInfo, ...billingInfo };
    if (settings) company.settings = { ...company.settings, ...settings };

    await company.save();

    const companyResponse = company.toObject();
    delete companyResponse.password;

    res.status(200).json({
      success: true,
      message: 'Company updated successfully',
      data: companyResponse
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating company',
      error: error.message
    });
  }
};

// @desc    Delete company (soft delete)
// @route   DELETE /api/companies/:id
// @access  Super Admin only
const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if company has active candidates or tests
    const [candidateCount, activeTestCount] = await Promise.all([
      Candidate.countDocuments({ companyId: req.params.id, status: 'active' }),
      TestResult.countDocuments({ companyId: req.params.id, status: 'in-progress' })
    ]);

    if (candidateCount > 0 || activeTestCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete company with active candidates or ongoing tests. Please deactivate first.'
      });
    }

    // Soft delete - set status to inactive
    company.status = 'inactive';
    await company.save();

    res.status(200).json({
      success: true,
      message: 'Company deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting company',
      error: error.message
    });
  }
};

// @desc    Bulk operations on companies
// @route   POST /api/companies/bulk
// @access  Super Admin only
const bulkOperations = async (req, res) => {
  try {
    const { action, companyIds } = req.body;

    if (!action || !companyIds || !Array.isArray(companyIds)) {
      return res.status(400).json({
        success: false,
        message: 'Action and company IDs are required'
      });
    }

    let updateData = {};
    let message = '';

    switch (action) {
      case 'activate':
        updateData = { status: 'active' };
        message = 'Companies activated successfully';
        break;
      case 'deactivate':
        updateData = { status: 'inactive' };
        message = 'Companies deactivated successfully';
        break;
      case 'suspend':
        updateData = { status: 'suspended', subscriptionStatus: 'suspended' };
        message = 'Companies suspended successfully';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    const result = await Company.updateMany(
      { _id: { $in: companyIds } },
      updateData
    );

    res.status(200).json({
      success: true,
      message,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error in bulk operations:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk operations',
      error: error.message
    });
  }
};

// @desc    Get company statistics
// @route   GET /api/companies/statistics
// @access  Super Admin only
const getCompanyStatistics = async (req, res) => {
  try {
    const [
      totalCompanies,
      activeCompanies,
      companiesByIndustry,
      companiesBySize,
      subscriptionStats,
      revenueStats
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ status: 'active' }),
      Company.aggregate([
        { $group: { _id: '$industry', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Company.aggregate([
        { $group: { _id: '$size', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Company.aggregate([
        { $group: { _id: '$subscriptionPlan', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Billing.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' }, invoiceCount: { $sum: 1 } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCompanies,
          activeCompanies,
          inactiveCompanies: totalCompanies - activeCompanies
        },
        distribution: {
          byIndustry: companiesByIndustry,
          bySize: companiesBySize,
          bySubscription: subscriptionStats
        },
        revenue: revenueStats[0] || { totalRevenue: 0, invoiceCount: 0 }
      }
    });
  } catch (error) {
    console.error('Error fetching company statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

// @desc    Add credits to company
// @route   POST /api/companies/:id/credits
// @access  Super Admin only
const addCredits = async (req, res) => {
  try {
    const { credits, reason } = req.body;

    if (!credits || credits <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid credit amount is required'
      });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    await company.addCredits(credits);

    res.status(200).json({
      success: true,
      message: 'Credits added successfully',
      data: {
        creditsAdded: credits,
        newBalance: company.creditsRemaining,
        reason
      }
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding credits',
      error: error.message
    });
  }
};

// @desc    Resend company credentials
// @route   POST /api/companies/:id/resend-credentials
// @access  Super Admin only
const resendCompanyCredentials = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json(createErrorResponse('Company not found'));
    }

    if (!company.passwordResetRequired) {
      return res.status(400).json(createErrorResponse('Company has already completed initial setup. Cannot resend credentials.'));
    }

    const temporaryPassword = generateSystemPassword();
    company.password = temporaryPassword;
    await company.save();

    try {
      await sendEmail({
        to: company.email,
        subject: 'Your Updated Company Credentials for AI Test Portal',
        template: 'company-credentials',
        data: {
          companyName: company.companyName,
          email: company.email,
          password: temporaryPassword,
          loginUrl: `${process.env.CLIENT_URL}/login`,
          contactPerson: company.contactPerson?.name || 'there',
        },
      });

      return res.status(200).json(createSuccessResponse(
        'Credentials resent successfully.',
        { temporaryPassword, emailSent: true },
      ));
    } catch (emailError) {
      console.error('Failed to send credentials email:', emailError);
      return res.status(200).json(createSuccessResponse(
        'Password updated, but failed to send email. Please provide the credentials manually.',
        { temporaryPassword, emailSent: false },
      ));
    }
  } catch (error) {
    console.error('Error resending company credentials:', error);
    res.status(500).json(createErrorResponse('An unexpected error occurred while resending credentials.'));
  }
};

module.exports = {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  bulkOperations,
  getCompanyStatistics,
  addCredits,
  bulkUpdateCompanies: bulkOperations,
  bulkDeleteCompanies: bulkOperations,
  getCompanyBilling: getCompanyById,
  resendCompanyCredentials
};
