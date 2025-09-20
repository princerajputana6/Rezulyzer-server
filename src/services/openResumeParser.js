// OpenResume adapter (Option A: vendor parser code under server/src/vendor/openresume)
// This adapter expects a local vendor module that exposes a parse(text) function
// returning a structured JSON of resume data. Since OpenResume isn't published as
// an npm package, paste or vendor their parser into server/src/vendor/openresume/
// and export a function named parse that accepts raw text.

const path = require('path');

let vendor;
try {
  // Expecting: module.exports = { parse: async (text) => ({ ... }) }
  // You will add this file when you vendor OpenResume parser implementation.
  vendor = require('../vendor/openresume/parser');
} catch (e) {
  vendor = null;
}

function safe(v, d = '') { return (v ?? d); }
function arr(a) { return Array.isArray(a) ? a : []; }

// Map OpenResume-style output to our unified AI-like schema expected by mapAiProfileToCandidate
function mapOpenResumeToAiSchema(orJson = {}) {
  const personal = orJson.personal || orJson.basics || orJson.profile || {};
  const work = arr(orJson.work || orJson.experience || orJson.experiences);
  const education = arr(orJson.education);
  const skills = arr(orJson.skills);
  const projects = arr(orJson.projects);
  const certifications = arr(orJson.certifications || orJson.awards);

  // Build AI-like object
  return {
    personalInfo: {
      fullName: safe(personal.name || `${safe(personal.firstName,'').trim()} ${safe(personal.lastName,'').trim()}`.trim()),
      firstName: safe(personal.firstName),
      lastName: safe(personal.lastName),
      email: safe(personal.email),
      phone: safe(personal.phone || personal.phoneNumber),
      address: {
        street: safe(personal.address?.streetAddress || personal.address?.street),
        city: safe(personal.address?.city),
        state: safe(personal.address?.region || personal.address?.state),
        zipCode: safe(personal.address?.postalCode || personal.address?.zip),
        country: safe(personal.address?.country)
      },
      socialProfiles: {
        linkedin: safe(personal.profiles?.linkedin || personal.linkedin),
        github: safe(personal.profiles?.github || personal.github),
        portfolio: safe(personal.website || personal.url)
      },
      summary: safe(orJson.summary || personal.summary || personal.objective),
      objective: safe(personal.objective)
    },
    professionalSummary: {
      totalExperience: safe(orJson.totalExperience || ''),
      currentRole: safe(work[0]?.position || work[0]?.title || ''),
      industryExperience: [],
      careerLevel: safe(orJson.careerLevel || '')
    },
    workExperience: work.map(w => ({
      company: safe(w.company),
      position: safe(w.position || w.title),
      location: safe(w.location || w.city || ''),
      startDate: safe(w.startDate || w.start),
      endDate: safe(w.endDate || w.end),
      isCurrentJob: !w.endDate && !w.end ? true : false,
      duration: safe(w.duration || ''),
      responsibilities: arr(w.highlights || w.responsibilities || w.summary ? [w.summary] : []).filter(Boolean),
      achievements: arr(w.achievements),
      technologies: arr(w.technologies || w.tools || [])
    })),
    education: education.map(ed => ({
      institution: safe(ed.institution || ed.school || ed.university),
      degree: safe(ed.degree || ed.studyType),
      fieldOfStudy: safe(ed.area || ed.field),
      location: safe(ed.location || ''),
      graduationDate: safe(ed.endDate || ed.graduationDate || ed.date),
      gpa: safe(ed.gpa),
      coursework: arr(ed.courses),
      honors: []
    })),
    skills: {
      technical: {
        programmingLanguages: skills.flatMap(s => s.keywords || s.items || []).filter(Boolean),
        frameworks: [],
        databases: [],
        tools: [],
        cloudPlatforms: [],
        operatingSystems: [],
        methodologies: []
      },
      soft: []
    },
    certifications: certifications.map(c => ({
      name: safe(c.title || c.name),
      issuer: safe(c.issuer || c.awarder),
      dateObtained: safe(c.date),
      platform: '',
      instructors: [],
      url: safe(c.url)
    })),
    projects: projects.map(p => ({
      name: safe(p.name || p.title),
      description: safe(p.description),
      technologies: arr(p.technologies || p.keywords || p.tools || []),
      url: safe(p.url || p.link),
      features: [],
      achievements: arr(p.achievements)
    }))
  };
}

async function parseOpenResumeText(rawText) {
  if (!vendor || typeof vendor.parse !== 'function') {
    throw new Error('OpenResume vendor parser not found. Please vendor code at server/src/vendor/openresume/parser.js');
  }
  const result = await vendor.parse(rawText);
  // Map to our AI-like schema
  return mapOpenResumeToAiSchema(result);
}

async function parseRawOpenResumeText(rawText) {
  if (!vendor || typeof vendor.parse !== 'function') {
    throw new Error('OpenResume vendor parser not found. Please vendor code at server/src/vendor/openresume/parser.js');
  }
  return await vendor.parse(rawText);
}

module.exports = {
  parseOpenResumeText,
  parseRawOpenResumeText,
  mapOpenResumeToAiSchema
};
