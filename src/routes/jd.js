const express = require('express');
const { body, param, query } = require('express-validator');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { requireOwnerOrAdmin } = require('../middleware/roleAuth');
const jdController = require('../controllers/jdController');

const router = express.Router();

router.use(protect);

router.post('/',
  requireOwnerOrAdmin,
  [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title 3-200 chars required'),
    body('companyId').optional().isMongoId().withMessage('Invalid company ID'),
    body('requiredSkills').optional().isArray().withMessage('requiredSkills must be an array'),
    body('minExperience').optional().isInt({ min: 0, max: 50 }).withMessage('minExperience 0-50'),
    body('maxExperience').optional().isInt({ min: 0, max: 50 }).withMessage('maxExperience 0-50'),
  ],
  handleValidationErrors,
  jdController.createJD
);

router.get('/',
  [ query('status').optional().isIn(['draft','active','archived']).withMessage('Invalid status') ],
  handleValidationErrors,
  jdController.listJDs
);

router.get('/:id', [ param('id').isMongoId() ], handleValidationErrors, jdController.getJD);

router.put('/:id',
  requireOwnerOrAdmin,
  [
    param('id').isMongoId(),
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('requiredSkills').optional().isArray(),
    body('minExperience').optional().isInt({ min: 0, max: 50 }),
    body('maxExperience').optional().isInt({ min: 0, max: 50 }),
    body('status').optional().isIn(['draft','active','archived'])
  ],
  handleValidationErrors,
  jdController.updateJD
);

router.delete('/:id', requireOwnerOrAdmin, [ param('id').isMongoId() ], handleValidationErrors, jdController.deleteJD);

router.get('/:id/match-candidates', [ param('id').isMongoId() ], handleValidationErrors, jdController.matchCandidates);

module.exports = router;
