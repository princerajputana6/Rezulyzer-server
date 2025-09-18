const express = require('express');
const { protect } = require('../middleware/auth');
const { getLatestAssignedTest } = require('../controllers/candidatePortalController');

const router = express.Router();

// Candidate portal: get latest assigned test id
router.get('/me/latest-test', protect, getLatestAssignedTest);

module.exports = router;
