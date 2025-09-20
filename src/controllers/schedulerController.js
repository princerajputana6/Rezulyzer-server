const ScheduledJob = require('../models/ScheduledJob');
const Test = require('../models/Test');
const Candidate = require('../models/Candidate');
const { sendAssessmentEmail } = require('../services/emailService');
const { asyncHandler } = require('../middleware/errorHandler');
const { createSuccessResponse, createErrorResponse } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

// Endpoint to be called by Cloudflare Cron Trigger
// Secure using a shared token header: X-CF-Cron-Token
const processCron = asyncHandler(async (req, res) => {
  const token = req.get('X-CF-Cron-Token');
  if (!token || token !== process.env.CF_CRON_TOKEN) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(createErrorResponse('Forbidden'));
  }

  const now = new Date();
  // Fetch due jobs
  const jobs = await ScheduledJob.find({ status: 'pending', scheduledAt: { $lte: now } }).limit(50);
  let processed = 0;
  for (const job of jobs) {
    try {
      job.status = 'processing';
      job.attempts += 1;
      await job.save();

      if (job.type === 'invite_test') {
        await handleInviteTest(job.payload);
      }

      job.status = 'done';
      job.lastError = undefined;
      await job.save();
      processed += 1;
    } catch (err) {
      logger.error('Scheduled job failed:', err);
      job.status = 'failed';
      job.lastError = err?.message || 'Unknown error';
      await job.save();
    }
  }

  return res.json(createSuccessResponse('Cron processed', { processed }));
});

async function handleInviteTest(payload) {
  const { testId, emails = [], message, loginBaseUrl } = payload || {};
  if (!testId || !Array.isArray(emails) || emails.length === 0) return;

  const base = (loginBaseUrl || process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const loginUrl = `${base}/assessment-login`;

  const test = await Test.findById(testId).populate('createdBy', 'firstName lastName email');
  const companyName = (test && test.createdBy) ? `${test.createdBy.firstName || ''} ${test.createdBy.lastName || ''}`.trim() || 'Your Company' : 'Your Company';

  for (const email of emails) {
    try {
      await sendAssessmentEmail(email, {
        candidateName: email.split('@')[0],
        companyName,
        email,
        password: 'Use link to login',
        loginUrl,
        message
      });
    } catch (e) {
      logger.warn(`Failed to send invite to ${email}: ${e.message}`);
    }
  }
}

module.exports = {
  processCron,
};
