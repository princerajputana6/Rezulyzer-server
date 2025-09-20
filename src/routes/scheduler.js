const express = require('express');
const { processCron } = require('../controllers/schedulerController');

const router = express.Router();

// Cloudflare Cron Trigger target
router.post('/cron', processCron);

module.exports = router;
