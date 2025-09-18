const Interview = require('../models/Interview');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Company = require('../models/Company');

// @desc    Get all interviews
// @route   GET /api/interviews
// @access  Private (Company Admin, Super Admin)
const getInterviews = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type, 
      startDate, 
      endDate,
      candidateId,
      interviewerId 
    } = req.query;

    // Build query based on user role
    let query = {};
    
    if (req.user.role === 'company') {
      query.companyId = req.user.companyId || req.user._id;
    } else if (req.user.role === 'admin' && req.user.companyId) {
      query.companyId = req.user.companyId;
    }
    // Super admin can see all interviews (no additional filter)

    // Apply filters
    if (status) query.status = status;
    if (type) query.type = type;
    if (candidateId) query.candidateId = candidateId;
    if (interviewerId) query.interviewerId = interviewerId;
    
    if (startDate && endDate) {
      query.scheduledDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [interviews, totalCount] = await Promise.all([
      Interview.find(query)
        .sort({ scheduledDate: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('candidateId', 'name email phone')
        .populate('interviewerId', 'firstName lastName email')
        .populate('companyId', 'companyName')
        .populate('createdBy', 'firstName lastName')
        .populate('attendees.userId', 'firstName lastName email'),
      Interview.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);
    const currentPage = parseInt(page);

    res.status(200).json({
      success: true,
      data: interviews,
      pagination: {
        currentPage,
        totalPages,
        totalItems: totalCount,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching interviews',
      error: error.message
    });
  }
};

// @desc    Get single interview
// @route   GET /api/interviews/:id
// @access  Private
const getInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('candidateId', 'name email phone location')
      .populate('interviewerId', 'firstName lastName email')
      .populate('companyId', 'companyName')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('attendees.userId', 'firstName lastName email')
      .populate('relatedTestId', 'testName')
      .populate('relatedTestResultId', 'percentage status');

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check permissions
    if (req.user.role === 'company' && 
        interview.companyId._id.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: interview
    });
  } catch (error) {
    console.error('Error fetching interview:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching interview',
      error: error.message
    });
  }
};

// @desc    Create new interview
// @route   POST /api/interviews
// @access  Private (Company Admin, Super Admin)
const createInterview = async (req, res) => {
  try {
    const {
      title,
      description,
      candidateId,
      interviewerId,
      scheduledDate,
      duration,
      type,
      mode,
      meetingLink,
      location,
      priority,
      preparation,
      attendees,
      relatedTestId,
      relatedTestResultId
    } = req.body;

    // Validate candidate exists and belongs to company
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Validate interviewer exists
    const interviewer = await User.findById(interviewerId);
    if (!interviewer) {
      return res.status(404).json({
        success: false,
        message: 'Interviewer not found'
      });
    }

    // Set company ID based on user role
    let companyId;
    if (req.user.role === 'super-admin') {
      companyId = candidate.companyId;
    } else {
      companyId = req.user.companyId || req.user._id;
      
      // Verify candidate belongs to this company
      if (candidate.companyId.toString() !== companyId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Candidate does not belong to your company'
        });
      }
    }

    const interview = await Interview.create({
      title,
      description,
      candidateId,
      companyId,
      interviewerId,
      scheduledDate: new Date(scheduledDate),
      duration: duration || 60,
      type: type || 'technical',
      mode: mode || 'online',
      meetingLink,
      location,
      priority: priority || 'medium',
      preparation,
      attendees: attendees || [],
      relatedTestId,
      relatedTestResultId,
      createdBy: req.user._id,
      reminders: [
        { type: 'email', timing: 60 }, // 1 hour before
        { type: 'email', timing: 15 }  // 15 minutes before
      ]
    });

    const populatedInterview = await Interview.findById(interview._id)
      .populate('candidateId', 'name email phone')
      .populate('interviewerId', 'firstName lastName email')
      .populate('companyId', 'companyName')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Interview scheduled successfully',
      data: populatedInterview
    });
  } catch (error) {
    console.error('Error creating interview:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating interview',
      error: error.message
    });
  }
};

// @desc    Update interview
// @route   PUT /api/interviews/:id
// @access  Private
const updateInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check permissions
    if (req.user.role === 'company' && 
        interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'scheduledDate', 'duration', 'type', 'mode',
      'meetingLink', 'location', 'priority', 'preparation', 'attendees',
      'status', 'feedback'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    updates.updatedBy = req.user._id;

    const updatedInterview = await Interview.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('candidateId', 'name email phone')
     .populate('interviewerId', 'firstName lastName email')
     .populate('companyId', 'companyName')
     .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Interview updated successfully',
      data: updatedInterview
    });
  } catch (error) {
    console.error('Error updating interview:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating interview',
      error: error.message
    });
  }
};

// @desc    Delete interview
// @route   DELETE /api/interviews/:id
// @access  Private
const deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check permissions
    if (req.user.role === 'company' && 
        interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await Interview.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Interview deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting interview:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting interview',
      error: error.message
    });
  }
};

// @desc    Get upcoming interviews
// @route   GET /api/interviews/upcoming
// @access  Private
const getUpcomingInterviews = async (req, res) => {
  try {
    const { days = 7, limit = 10 } = req.query;
    
    let companyId = null;
    if (req.user.role === 'company') {
      companyId = req.user.companyId || req.user._id;
    } else if (req.user.role === 'admin' && req.user.companyId) {
      companyId = req.user.companyId;
    }

    const interviews = await Interview.findUpcoming(companyId, parseInt(days))
      .limit(parseInt(limit))
      .populate('candidateId', 'name email phone')
      .populate('interviewerId', 'firstName lastName email')
      .populate('companyId', 'companyName');

    res.status(200).json({
      success: true,
      data: interviews,
      count: interviews.length
    });
  } catch (error) {
    console.error('Error fetching upcoming interviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming interviews',
      error: error.message
    });
  }
};

// @desc    Get interview statistics
// @route   GET /api/interviews/stats
// @access  Private
const getInterviewStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let companyId = null;
    if (req.user.role === 'company') {
      companyId = req.user.companyId || req.user._id;
    } else if (req.user.role === 'admin' && req.user.companyId) {
      companyId = req.user.companyId;
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const stats = await Interview.getStats(companyId, start, end);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalInterviews: 0,
        scheduledCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        avgDuration: 0,
        avgRating: 0
      }
    });
  } catch (error) {
    console.error('Error fetching interview stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching interview statistics',
      error: error.message
    });
  }
};

// @desc    Reschedule interview
// @route   PUT /api/interviews/:id/reschedule
// @access  Private
const rescheduleInterview = async (req, res) => {
  try {
    const { scheduledDate } = req.body;

    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'New scheduled date is required'
      });
    }

    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check permissions
    if (req.user.role === 'company' && 
        interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await interview.reschedule(new Date(scheduledDate), req.user._id);

    const updatedInterview = await Interview.findById(interview._id)
      .populate('candidateId', 'name email phone')
      .populate('interviewerId', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Interview rescheduled successfully',
      data: updatedInterview
    });
  } catch (error) {
    console.error('Error rescheduling interview:', error);
    res.status(500).json({
      success: false,
      message: 'Error rescheduling interview',
      error: error.message
    });
  }
};

// @desc    Cancel interview
// @route   PUT /api/interviews/:id/cancel
// @access  Private
const cancelInterview = async (req, res) => {
  try {
    const { reason } = req.body;

    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check permissions
    if (req.user.role === 'company' && 
        interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await interview.cancel(req.user._id, reason);

    const updatedInterview = await Interview.findById(interview._id)
      .populate('candidateId', 'name email phone')
      .populate('interviewerId', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Interview cancelled successfully',
      data: updatedInterview
    });
  } catch (error) {
    console.error('Error cancelling interview:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling interview',
      error: error.message
    });
  }
};

// @desc    Complete interview with feedback
// @route   PUT /api/interviews/:id/complete
// @access  Private
const completeInterview = async (req, res) => {
  try {
    const { feedback } = req.body;

    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check permissions
    if (req.user.role === 'company' && 
        interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const feedbackData = {
      ...feedback,
      updatedBy: req.user._id
    };

    await interview.markCompleted(feedbackData);

    const updatedInterview = await Interview.findById(interview._id)
      .populate('candidateId', 'name email phone')
      .populate('interviewerId', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Interview completed successfully',
      data: updatedInterview
    });
  } catch (error) {
    console.error('Error completing interview:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing interview',
      error: error.message
    });
  }
};

module.exports = {
  getInterviews,
  getInterview,
  createInterview,
  updateInterview,
  deleteInterview,
  getUpcomingInterviews,
  getInterviewStats,
  rescheduleInterview,
  cancelInterview,
  completeInterview
};

// --- Attendee Management ---
// @desc    Add attendee to interview
// @route   POST /api/interviews/:id/attendees
// @access  Private
const addAttendee = async (req, res) => {
  try {
    const { userId, role = 'interviewer' } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
    if (req.user.role === 'company' && interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    // Prevent duplicates
    const exists = interview.attendees?.some(a => a.userId?.toString() === userId);
    if (exists) return res.status(400).json({ success: false, message: 'Attendee already added' });

    interview.attendees = interview.attendees || [];
    interview.attendees.push({ userId, role, confirmed: false });
    interview.updatedBy = req.user._id;
    await interview.save();

    const populated = await Interview.findById(interview._id)
      .populate('attendees.userId', 'firstName lastName email');

    return res.status(200).json({ success: true, message: 'Attendee added', data: populated.attendees });
  } catch (error) {
    console.error('Error adding attendee:', error);
    return res.status(500).json({ success: false, message: 'Error adding attendee', error: error.message });
  }
};

// @desc    Remove attendee from interview
// @route   DELETE /api/interviews/:id/attendees/:attendeeId
// @access  Private
const removeAttendee = async (req, res) => {
  try {
    const { id, attendeeId } = req.params;
    const interview = await Interview.findById(id);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
    if (req.user.role === 'company' && interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const before = interview.attendees?.length || 0;
    interview.attendees = (interview.attendees || []).filter(a => a._id?.toString() !== attendeeId);
    if ((interview.attendees?.length || 0) === before) {
      return res.status(404).json({ success: false, message: 'Attendee not found' });
    }
    interview.updatedBy = req.user._id;
    await interview.save();
    return res.status(200).json({ success: true, message: 'Attendee removed' });
  } catch (error) {
    console.error('Error removing attendee:', error);
    return res.status(500).json({ success: false, message: 'Error removing attendee', error: error.message });
  }
};

// @desc    Confirm attendee participation
// @route   PUT /api/interviews/:id/attendees/:attendeeId/confirm
// @access  Private
const confirmAttendee = async (req, res) => {
  try {
    const { id, attendeeId } = req.params;
    const { confirmed = true } = req.body;
    const interview = await Interview.findById(id);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
    if (req.user.role === 'company' && interview.companyId.toString() !== (req.user.companyId || req.user._id).toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const attendee = (interview.attendees || []).find(a => a._id?.toString() === attendeeId);
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found' });
    attendee.confirmed = Boolean(confirmed);
    interview.updatedBy = req.user._id;
    await interview.save();
    return res.status(200).json({ success: true, message: 'Attendee updated', data: attendee });
  } catch (error) {
    console.error('Error confirming attendee:', error);
    return res.status(500).json({ success: false, message: 'Error confirming attendee', error: error.message });
  }
};

module.exports.addAttendee = addAttendee;
module.exports.removeAttendee = removeAttendee;
module.exports.confirmAttendee = confirmAttendee;
