const express = require('express');
const { body } = require('express-validator');
const {
  getCandidates,
  getCandidate,
  uploadResume,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  downloadResume,
  getCandidateStats,
  sendAssessment,
  generateAssessment,
  validateAssessmentToken,
  assessmentLogin
} = require('../controllers/candidateController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Skip all authentication and authorization for candidate routes temporarily
router.use((req, res, next) => {
  console.log(`[DEBUG] Candidate route accessed: ${req.method} ${req.path}`);
  next();
});

// Validation rules
const candidateValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  body('summary')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Summary cannot exceed 2000 characters')
];

// Routes
router.route('/stats')
  .get(getCandidateStats);

router.route('/upload-resume')
  .post(uploadResume);

router.route('/')
  .get(getCandidates)
  .post(candidateValidation, createCandidate);

router.route('/:id')
  .get(getCandidate)
  .put(candidateValidation, updateCandidate)
  .delete(deleteCandidate);

router.route('/:id/resume')
  .get(protect, downloadResume);

router.route('/:id/send-assessment')
  .post(protect, sendAssessment);

// AI-generated assessment from candidate resume/profile
router.route('/:id/generate-assessment')
  .post(protect, generateAssessment);

// Public assessment routes (no authentication required)
router.route('/assessment/validate/:token')
  .get(validateAssessmentToken);

router.route('/assessment/login')
  .post(assessmentLogin);

module.exports = router;
