const express = require('express');
const {
  getInterviews,
  getInterview,
  createInterview,
  updateInterview,
  deleteInterview,
  getUpcomingInterviews,
  getInterviewStats,
  rescheduleInterview,
  cancelInterview,
  completeInterview,
  addAttendee,
  removeAttendee,
  confirmAttendee
} = require('../controllers/interviewController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(authorize('super-admin', 'admin', 'company'), getInterviews)
  .post(authorize('super-admin', 'admin', 'company'), createInterview);

router.route('/upcoming')
  .get(authorize('super-admin', 'admin', 'company'), getUpcomingInterviews);

router.route('/stats')
  .get(authorize('super-admin', 'admin', 'company'), getInterviewStats);

router.route('/:id')
  .get(authorize('super-admin', 'admin', 'company'), getInterview)
  .put(authorize('super-admin', 'admin', 'company'), updateInterview)
  .delete(authorize('super-admin', 'admin', 'company'), deleteInterview);

router.route('/:id/reschedule')
  .put(authorize('super-admin', 'admin', 'company'), rescheduleInterview);

router.route('/:id/cancel')
  .put(authorize('super-admin', 'admin', 'company'), cancelInterview);

router.route('/:id/complete')
  .put(authorize('super-admin', 'admin', 'company'), completeInterview);

// Attendees
router.route('/:id/attendees')
  .post(authorize('super-admin', 'admin', 'company'), addAttendee);

router.route('/:id/attendees/:attendeeId')
  .delete(authorize('super-admin', 'admin', 'company'), removeAttendee);

router.route('/:id/attendees/:attendeeId/confirm')
  .put(authorize('super-admin', 'admin', 'company'), confirmAttendee);

module.exports = router;
