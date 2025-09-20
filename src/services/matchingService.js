// Simple candidate-to-JD matching service for MERN Phase A
// Scoring:
// - Skills overlap: weight 70% (importanceLevel 1-5 scales weight)
// - Experience alignment: weight 30% (within range gets full, penalty outside)

function normalizeSkillName(name = '') {
  return String(name).trim().toLowerCase();
}

function skillScore(candidateSkills = [], jdRequiredSkills = []) {
  if (!jdRequiredSkills.length) return 0;
  const cset = new Set(candidateSkills.map(s => normalizeSkillName(s.name || s.skill || s)));
  let earned = 0;
  let total = 0;
  jdRequiredSkills.forEach(rs => {
    const imp = Math.min(5, Math.max(1, Number(rs.importanceLevel || 3)));
    total += imp;
    if (cset.has(normalizeSkillName(rs.skillName))) {
      earned += imp;
    }
  });
  return total > 0 ? (earned / total) : 0;
}

function experienceScore(candidateYears = 0, minExp = 0, maxExp = 50) {
  const years = Number(candidateYears || 0);
  const minY = Number(minExp || 0);
  const maxY = Number(maxExp || minY);
  if (years >= minY && years <= maxY) return 1;
  // linear penalty outside range, capped at 0
  if (years < minY) {
    const deficit = minY - years;
    return Math.max(0, 1 - deficit / Math.max(1, minY));
  }
  const excess = years - maxY;
  return Math.max(0, 1 - excess / Math.max(1, maxY));
}

function scoreCandidateAgainstJD(candidate, jd) {
  const cSkills = candidate.skills || candidate.parsedProfile?.skills?.technical || [];
  const jdSkills = jd.requiredSkills || [];
  const skills = skillScore(cSkills, jdSkills);
  const candYears = candidate.additionalInfo?.totalExperience || candidate.experienceYears || 0;
  const exp = experienceScore(candYears, jd.minExperience, jd.maxExperience);
  // weights: 70% skills, 30% experience
  const score = (skills * 0.7 + exp * 0.3) * 100;
  return Math.round(score);
}

module.exports = {
  scoreCandidateAgainstJD
};
