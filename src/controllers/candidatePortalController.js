const Candidate = require('../models/Candidate');

// @desc Get latest assigned test for logged-in candidate
// @route GET /api/candidate/me/latest-test
// @access Candidate (token)
const getLatestAssignedTest = async (req, res) => {
  try {
    // req.user is populated by protect middleware (can be Candidate)
    const candidateId = req.user._id;

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const assigned = (candidate.assignedTests || []).slice().sort((a, b) => {
      const aTime = new Date(a.assignedAt || 0).getTime();
      const bTime = new Date(b.assignedAt || 0).getTime();
      return bTime - aTime;
    });

    if (!assigned.length) {
      return res.status(404).json({ success: false, message: 'No tests assigned' });
    }

    return res.json({ success: true, data: { testId: assigned[0].testId } });
  } catch (err) {
    console.error('getLatestAssignedTest error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getLatestAssignedTest };
