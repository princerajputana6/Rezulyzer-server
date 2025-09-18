const express = require('express');
const router = express.Router();
const { loginCandidate } = require('../controllers/candidateAuthController');

// @route   POST /api/candidate/auth/login
// @desc    Authenticate candidate & get token
// @access  Public
router.post('/login', loginCandidate);

module.exports = router;
