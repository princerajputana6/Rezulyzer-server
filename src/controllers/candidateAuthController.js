const Candidate = require('../models/Candidate');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @desc    Login candidate
// @route   POST /api/candidate/auth/login
// @access  Public
const loginCandidate = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check for candidate
    const candidate = await Candidate.findOne({ email });
    if (!candidate) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, candidate.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Create token
    const payload = {
      id: candidate._id,
      name: candidate.name,
      email: candidate.email,
      role: 'candidate'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      success: true,
      token: `Bearer ${token}`
    });
  } catch (error) {
    console.error('Candidate login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  loginCandidate
};
