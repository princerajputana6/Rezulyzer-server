const Candidate = require('../models/Candidate');

// Auth middleware that recognizes Candidate assessment session tokens
// If a valid candidate session is found, sets req.user with role 'candidate'
// If not found, it simply calls next() so other auth (e.g., protect) can run
module.exports.candidateProtect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')
      ? auth.substring('Bearer '.length)
      : auth;

    if (!token) return next();

    const candidate = await Candidate.findOne({
      assessmentSessionToken: token,
      assessmentSessionExpiry: { $gt: new Date() }
    }).select('_id name email');

    if (!candidate) return next();

    // Attach minimal user payload for downstream access checks
    req.user = {
      id: candidate._id.toString(),
      _id: candidate._id,
      role: 'candidate',
      email: candidate.email,
      name: candidate.name,
    };
    // Some controllers read role from req.userRole
    req.userRole = 'candidate';
    req.isCandidate = true;

    return next();
  } catch (e) {
    // Do not block other auth paths
    return next();
  }
};
