const { validationResult } = require('express-validator');
const JobDescription = require('../models/JobDescription');
const Candidate = require('../models/Candidate');
const { asyncHandler } = require('../middleware/errorHandler');
const { createSuccessResponse, createErrorResponse } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');
const matchingService = require('../services/matchingService');

// Create JD
const createJD = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('Validation failed', { errors: errors.array() }));
  }
  const companyId = req.user.company || req.body.companyId;
  const payload = {
    companyId,
    title: req.body.title,
    description: req.body.description || '',
    requiredSkills: req.body.requiredSkills || [],
    minExperience: req.body.minExperience ?? 0,
    maxExperience: req.body.maxExperience ?? 50,
    status: req.body.status || 'active',
    createdBy: req.user._id,
  };
  const jd = await JobDescription.create(payload);
  return res.json(createSuccessResponse('JD created', jd));
});

// List JDs (by company)
const listJDs = asyncHandler(async (req, res) => {
  const companyId = req.user.company || req.query.companyId;
  const query = { companyId };
  if (req.query.status) query.status = req.query.status;
  const items = await JobDescription.find(query).sort({ createdAt: -1 });
  return res.json(createSuccessResponse('OK', { items }));
});

// Get JD by id
const getJD = asyncHandler(async (req, res) => {
  const jd = await JobDescription.findById(req.params.id);
  if (!jd) return res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('JD not found'));
  return res.json(createSuccessResponse('OK', jd));
});

// Update JD
const updateJD = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(createErrorResponse('Validation failed', { errors: errors.array() }));
  }
  const jd = await JobDescription.findById(req.params.id);
  if (!jd) return res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('JD not found'));
  if (req.user.company?.toString && jd.companyId.toString() !== req.user.company.toString()) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(createErrorResponse('Forbidden'));
  }
  jd.title = req.body.title ?? jd.title;
  jd.description = req.body.description ?? jd.description;
  if (Array.isArray(req.body.requiredSkills)) jd.requiredSkills = req.body.requiredSkills;
  if (req.body.minExperience != null) jd.minExperience = req.body.minExperience;
  if (req.body.maxExperience != null) jd.maxExperience = req.body.maxExperience;
  if (req.body.status) jd.status = req.body.status;
  await jd.save();
  return res.json(createSuccessResponse('JD updated', jd));
});

// Delete JD
const deleteJD = asyncHandler(async (req, res) => {
  const jd = await JobDescription.findById(req.params.id);
  if (!jd) return res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('JD not found'));
  if (req.user.company?.toString && jd.companyId.toString() !== req.user.company.toString()) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(createErrorResponse('Forbidden'));
  }
  await jd.deleteOne();
  return res.json(createSuccessResponse('JD deleted'));
});

// Match candidates for a JD
const matchCandidates = asyncHandler(async (req, res) => {
  const jd = await JobDescription.findById(req.params.id);
  if (!jd) return res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('JD not found'));
  const companyId = jd.companyId;

  // Basic filter by company
  const candidates = await Candidate.find({ company: companyId }).lean();
  const results = candidates.map(c => ({
    candidateId: c._id,
    name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    email: c.email,
    score: matchingService.scoreCandidateAgainstJD(c, jd),
    skills: c.skills || [],
    experienceYears: c.additionalInfo?.totalExperience || c.experienceYears || 0,
    status: c.status || 'new'
  })).sort((a, b) => b.score - a.score);

  return res.json(createSuccessResponse('OK', { jdId: jd._id, results }));
});

module.exports = {
  createJD,
  listJDs,
  getJD,
  updateJD,
  deleteJD,
  matchCandidates,
};
