const Billing = require('../models/Billing');
const Company = require('../models/Company');
const { validationResult } = require('express-validator');

// @desc    Get all billing records with pagination and filters
// @route   GET /api/billing
// @access  Super Admin only
const getBillingRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      companyId = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'companyId.companyName': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) filter.status = status;
    if (companyId) filter.companyId = companyId;
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [billingRecords, totalCount] = await Promise.all([
      Billing.find(filter)
        .populate('companyId', 'companyName email industry subscriptionPlan')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Billing.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        billingRecords,
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
    console.error('Error fetching billing records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing records',
      error: error.message
    });
  }
};

// @desc    Get single billing record by ID
// @route   GET /api/billing/:id
// @access  Super Admin, Company (own records only)
const getBillingById = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id)
      .populate('companyId', 'companyName email contactPerson billingInfo')
      .lean();

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check permissions for company users
    if (req.user.role !== 'super-admin' && 
        billing.companyId._id.toString() !== (req.user.companyId || req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: billing
    });
  } catch (error) {
    console.error('Error fetching billing record:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing record',
      error: error.message
    });
  }
};

// @desc    Create new billing record/invoice
// @route   POST /api/billing
// @access  Super Admin only
const createBilling = async (req, res) => {
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
      companyId,
      amount,
      currency = 'USD',
      planName,
      billingPeriod,
      dueDate,
      items,
      taxes,
      discount = 0,
      notes,
      paymentMethod = 'credit_card'
    } = req.body;

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const billing = new Billing({
      companyId,
      amount,
      currency,
      planName,
      billingPeriod,
      dueDate: new Date(dueDate),
      items,
      taxes,
      discount,
      notes,
      paymentMethod
    });

    await billing.save();

    const populatedBilling = await Billing.findById(billing._id)
      .populate('companyId', 'companyName email');

    res.status(201).json({
      success: true,
      message: 'Billing record created successfully',
      data: populatedBilling
    });
  } catch (error) {
    console.error('Error creating billing record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating billing record',
      error: error.message
    });
  }
};

// @desc    Update billing record
// @route   PUT /api/billing/:id
// @access  Super Admin only
const updateBilling = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Don't allow updating paid invoices
    if (billing.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid invoices'
      });
    }

    const updateFields = [
      'amount', 'currency', 'planName', 'dueDate', 'items', 
      'taxes', 'discount', 'notes', 'paymentMethod'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        billing[field] = req.body[field];
      }
    });

    await billing.save();

    const updatedBilling = await Billing.findById(billing._id)
      .populate('companyId', 'companyName email');

    res.status(200).json({
      success: true,
      message: 'Billing record updated successfully',
      data: updatedBilling
    });
  } catch (error) {
    console.error('Error updating billing record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating billing record',
      error: error.message
    });
  }
};

// @desc    Mark invoice as paid
// @route   POST /api/billing/:id/pay
// @access  Super Admin only
const markAsPaid = async (req, res) => {
  try {
    const { transactionId, paymentDetails } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    if (billing.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid'
      });
    }

    await billing.markAsPaid(transactionId, paymentDetails);

    res.status(200).json({
      success: true,
      message: 'Invoice marked as paid successfully',
      data: billing
    });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment',
      error: error.message
    });
  }
};

// @desc    Get billing statistics
// @route   GET /api/billing/statistics
// @access  Super Admin only
const getBillingStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const [
      totalRevenue,
      pendingAmount,
      overdueAmount,
      revenueByPlan,
      revenueByMonth,
      topPayingCompanies
    ] = await Promise.all([
      Billing.aggregate([
        { $match: { status: 'paid', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Billing.aggregate([
        { $match: { status: 'pending', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Billing.aggregate([
        { $match: { status: 'overdue', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Billing.aggregate([
        { $match: { status: 'paid', ...dateFilter } },
        { $group: { _id: '$planName', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } }
      ]),
      Billing.aggregate([
        { $match: { status: 'paid', ...dateFilter } },
        {
          $group: {
            _id: {
              year: { $year: '$paidDate' },
              month: { $month: '$paidDate' }
            },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      Billing.aggregate([
        { $match: { status: 'paid', ...dateFilter } },
        { $group: { _id: '$companyId', totalPaid: { $sum: '$amount' }, invoiceCount: { $sum: 1 } } },
        { $sort: { totalPaid: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'companies',
            localField: '_id',
            foreignField: '_id',
            as: 'company'
          }
        },
        { $unwind: '$company' }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalRevenue: totalRevenue[0]?.total || 0,
          totalInvoices: totalRevenue[0]?.count || 0,
          pendingAmount: pendingAmount[0]?.total || 0,
          pendingInvoices: pendingAmount[0]?.count || 0,
          overdueAmount: overdueAmount[0]?.total || 0,
          overdueInvoices: overdueAmount[0]?.count || 0
        },
        charts: {
          revenueByPlan,
          revenueByMonth: revenueByMonth.map(item => ({
            period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            revenue: item.revenue,
            invoiceCount: item.count
          })),
          topPayingCompanies: topPayingCompanies.map(item => ({
            companyName: item.company.companyName,
            totalPaid: item.totalPaid,
            invoiceCount: item.invoiceCount
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching billing statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing statistics',
      error: error.message
    });
  }
};

// @desc    Get company billing history
// @route   GET /api/billing/company/:companyId
// @access  Super Admin, Company (own records only)
const getCompanyBilling = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check permissions
    if (req.user.role !== 'super-admin' && 
        companyId !== (req.user.companyId || req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [billingRecords, totalCount, company] = await Promise.all([
      Billing.find({ companyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Billing.countDocuments({ companyId }),
      Company.findById(companyId, 'companyName email subscriptionPlan').lean()
    ]);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Calculate summary statistics
    const [totalPaid, totalPending, totalOverdue] = await Promise.all([
      Billing.aggregate([
        { $match: { companyId: company._id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Billing.aggregate([
        { $match: { companyId: company._id, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Billing.aggregate([
        { $match: { companyId: company._id, status: 'overdue' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        company,
        billingRecords,
        summary: {
          totalPaid: totalPaid[0]?.total || 0,
          totalPending: totalPending[0]?.total || 0,
          totalOverdue: totalOverdue[0]?.total || 0
        },
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
    console.error('Error fetching company billing:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company billing',
      error: error.message
    });
  }
};

// @desc    Generate invoice PDF
// @route   GET /api/billing/:id/pdf
// @access  Super Admin, Company (own invoices only)
const generateInvoicePDF = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id)
      .populate('companyId', 'companyName email contactPerson billingInfo address')
      .lean();

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'super-admin' && 
        billing.companyId._id.toString() !== (req.user.companyId || req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // In a real application, you would generate a PDF here using libraries like puppeteer or jsPDF
    // For now, we'll return the invoice data that can be used to generate PDF on frontend
    
    const invoiceData = {
      invoice: billing,
      company: billing.companyId,
      generatedAt: new Date(),
      dueIn: Math.ceil((new Date(billing.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
    };

    res.status(200).json({
      success: true,
      message: 'Invoice data ready for PDF generation',
      data: invoiceData
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoice PDF',
      error: error.message
    });
  }
};

// @desc    Send payment reminder
// @route   POST /api/billing/:id/reminder
// @access  Super Admin only
const sendPaymentReminder = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id)
      .populate('companyId', 'companyName email contactPerson')
      .lean();

    if (!billing) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }

    if (billing.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send reminder for paid invoice'
      });
    }

    // In a real application, you would send an email here
    // For now, we'll just log the action
    console.log(`Payment reminder sent for invoice ${billing.invoiceNumber} to ${billing.companyId.email}`);

    res.status(200).json({
      success: true,
      message: 'Payment reminder sent successfully'
    });
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending payment reminder',
      error: error.message
    });
  }
};

module.exports = {
  getBillingRecords,
  getBillingById,
  createBilling,
  updateBilling,
  markAsPaid,
  getBillingStatistics,
  getCompanyBilling,
  generateInvoicePDF,
  sendPaymentReminder
};
