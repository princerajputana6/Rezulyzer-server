const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const aiService = require('../config/ai');
const logger = require('../utils/logger');

function hasAwsTextractConfig() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION);
}

function getTextractClient() {
  try {
    const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
    return { TextractClient, DetectDocumentTextCommand };
  } catch (e) {
    logger.warn('[resumeParser] @aws-sdk/client-textract not installed, skipping Textract');
    return null;
  }
}

async function extractWithTextract(buffer) {
  const mod = getTextractClient();
  if (!mod) throw new Error('Textract module not available');
  const client = new mod.TextractClient({ region: process.env.AWS_REGION });
  const command = new mod.DetectDocumentTextCommand({ Document: { Bytes: buffer } });
  const res = await client.send(command);
  const lines = (res.Blocks || []).filter(b => b.BlockType === 'LINE').map(b => b.Text).filter(Boolean);
  return lines.join('\n');
}

async function extractFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractFromDocx(buffer) {
  const res = await mammoth.extractRawText({ buffer });
  return res.value || '';
}

// Enhanced text cleaning function
function cleanResumeText(rawText) {
  return rawText
    .replace(/\s+/g, ' ')           // normalize whitespace
    .replace(/[^\x20-\x7E\n]/g, '') // remove non-ASCII except newlines
    .replace(/\n\s*\n/g, '\n')      // remove extra line breaks
    .trim();
}

async function extractRawText(buffer, mimeType, filename = '') {
  try {
    let rawText = '';
    
    // Prefer AWS Textract for high-quality OCR if configured
    if (hasAwsTextractConfig()) {
      try { 
        rawText = await extractWithTextract(buffer); 
        return cleanResumeText(rawText);
      } catch (e) { 
        logger.warn(`[resumeParser] Textract failed: ${e.message}`); 
      }
    }

    const ext = (path.extname(filename || '').toLowerCase());
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      try { 
        rawText = await extractFromPdf(buffer); 
        return cleanResumeText(rawText);
      } catch (e) { 
        logger.warn(`[resumeParser] PDF extraction failed: ${e.message}`); 
      }
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
      try { 
        rawText = await extractFromDocx(buffer); 
        return cleanResumeText(rawText);
      } catch (e) { 
        logger.warn(`[resumeParser] DOCX extraction failed: ${e.message}`); 
      }
    }

    // Last resort: treat as text
    rawText = buffer.toString('utf8');
    return cleanResumeText(rawText);
  } catch (err) {
    logger.error(`[resumeParser] extractRawText fatal: ${err.message}`);
    return '';
  }
}

function safeString(v) { return (v || '').toString().trim(); }
function safeArray(arr, defaultValue = []) { return Array.isArray(arr) ? arr : defaultValue; }
function safeObject(obj, defaultValue = {}) { return (obj && typeof obj === 'object') ? obj : defaultValue; }

// Enhanced comprehensive schema
const getComprehensiveSchema = () => {
  return `{
    "personalInfo": {
      "fullName": "string",
      "firstName": "string",
      "lastName": "string", 
      "email": "string",
      "phone": "string",
      "alternatePhone": "string",
      "address": {
        "street": "string",
        "city": "string",
        "state": "string", 
        "zipCode": "string",
        "country": "string"
      },
      "socialProfiles": {
        "linkedin": "string",
        "github": "string",
        "portfolio": "string",
        "twitter": "string",
        "other": ["string"]
      },
      "summary": "string",
      "objective": "string"
    },
    "professionalSummary": {
      "totalExperience": "string",
      "currentRole": "string", 
      "industryExperience": ["string"],
      "careerLevel": "string"
    },
    "workExperience": [{
      "company": "string",
      "position": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "isCurrentJob": "boolean",
      "duration": "string", 
      "responsibilities": ["string"],
      "achievements": ["string"],
      "technologies": ["string"],
      "teamSize": "string",
      "reportingTo": "string"
    }],
    "education": [{
      "institution": "string",
      "degree": "string", 
      "fieldOfStudy": "string",
      "location": "string",
      "graduationDate": "string",
      "gpa": "string",
      "coursework": ["string"],
      "honors": ["string"],
      "activities": ["string"]
    }],
    "skills": {
      "technical": {
        "programmingLanguages": ["string"],
        "frameworks": ["string"],
        "databases": ["string"],
        "tools": ["string"],
        "cloudPlatforms": ["string"],
        "operatingSystems": ["string"],
        "methodologies": ["string"]
      },
      "soft": ["string"],
      "languages": [{
        "language": "string",
        "proficiency": "string"
      }]
    },
    "certifications": [{
      "name": "string",
      "issuer": "string",
      "dateObtained": "string", 
      "expiryDate": "string",
      "credentialId": "string"
    }],
    "projects": [{
      "name": "string", 
      "description": "string",
      "technologies": ["string"],
      "duration": "string",
      "role": "string", 
      "achievements": ["string"],
      "url": "string"
    }],
    "achievements": [{
      "title": "string",
      "description": "string",
      "date": "string",
      "category": "string"
    }],
    "publications": [{
      "title": "string",
      "journal": "string", 
      "date": "string",
      "authors": ["string"],
      "url": "string"
    }],
    "volunteering": [{
      "organization": "string",
      "role": "string",
      "duration": "string", 
      "description": "string"
    }],
    "additionalInfo": {
      "availability": "string",
      "noticePeriod": "string",
      "expectedSalary": "string", 
      "willingToRelocate": "string",
      "visaStatus": "string",
      "references": ["string"],
      "hobbies": ["string"],
      "interests": ["string"]
    }
  }`;
};

// Enhanced AI analysis with comprehensive extraction
async function analyzeWithAI(rawText, useEnhanced = true) {
  const schema = getComprehensiveSchema();
  
  const enhancedPrompt = `You are an expert resume analyzer. Extract EVERY possible detail from this resume text with maximum precision and completeness.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON matching the schema below 
2. Extract ALL information present, even if partially mentioned or implied
3. For missing fields, use null (not empty strings or arrays)
4. Infer logical details when context allows (e.g., seniority level from job titles)
5. Parse dates in various formats (Jan 2020, 01/2020, January 2020, etc.)
6. Separate responsibilities (daily tasks) from achievements (measurable results)
7. Identify ALL technical skills mentioned throughout the resume (job descriptions, projects, etc.)
8. Extract soft skills from context (leadership experience → leadership skill)
9. Parse company information and role context
10. Extract education details including GPA, coursework, honors if mentioned
11. Look for certifications, licenses, publications, volunteering
12. Find salary expectations, availability, visa status if mentioned
13. Extract contact information and social profiles completely
14. Identify projects with technologies used and achievements
15. Parse languages spoken and proficiency levels

SCHEMA TO FOLLOW EXACTLY:
${schema}

RESUME TEXT TO ANALYZE:
${rawText}

EXTRACT COMPREHENSIVE JSON (return JSON only, no other text):`;

  const messages = [
    { 
      role: 'system', 
      content: 'You are a professional resume parser that extracts comprehensive structured data. You always return valid JSON matching the exact schema provided. Extract maximum details with high accuracy.' 
    },
    { role: 'user', content: enhancedPrompt }
  ];

  try {
    const res = await aiService.chatCompletion(messages, { 
      max_tokens: 4000,  // Increased for comprehensive data
      temperature: 0.05  // Lower temperature for consistency
    });
    
    const text = res?.choices?.[0]?.message?.content || '';
    
    // Enhanced JSON extraction
    let jsonText = text;
    
    // Try to extract JSON block first
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    // Clean up common JSON issues
    jsonText = jsonText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/'/g, '"')  // Replace single quotes with double quotes
      .trim();

    const parsedData = JSON.parse(jsonText);
    return parsedData;
    
  } catch (e) {
    logger.warn(`[resumeParser] Enhanced AI parsing failed: ${e.message}`);
    
    // Fallback to simpler extraction if comprehensive fails
    return await fallbackAnalysis(rawText);
  }
}

// Fallback analysis with simpler schema
async function fallbackAnalysis(rawText) {
  const simpleSchema = `{
    "name": "string",
    "email": "string", 
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "summary": "string",
    "skills": ["string"],
    "experience": [{"title": "string", "company": "string", "startDate": "string", "endDate": "string", "description": "string"}],
    "education": [{"institution": "string", "degree": "string", "graduationYear": "string"}],
    "certifications": ["string"]
  }`;

  const prompt = `Extract basic information from this resume. Return only JSON matching this schema:\n${simpleSchema}\n\nResume:\n${rawText}`;
  
  const messages = [
    { role: 'system', content: 'Extract basic resume information as JSON only.' },
    { role: 'user', content: prompt }
  ];

  const res = await aiService.chatCompletion(messages, { max_tokens: 1000, temperature: 0.1 });
  const text = res?.choices?.[0]?.message?.content || '{}';
  
  const match = text.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : '{}';
  
  return JSON.parse(jsonText);
}

// Enhanced mapping function to handle comprehensive data
function mapAiProfileToCandidate(aiData) {
  const personalInfo = safeObject(aiData.personalInfo);
  const skills = safeObject(aiData.skills);
  const technical = safeObject(skills.technical);
  const workExp = safeArray(aiData.workExperience);
  const education = safeArray(aiData.education);
  const projects = safeArray(aiData.projects);
  const certifications = safeArray(aiData.certifications);
  const additionalInfo = safeObject(aiData.additionalInfo);

  // Enhanced technical skills mapping
  const technicalSkills = [
    ...safeArray(technical.programmingLanguages),
    ...safeArray(technical.frameworks),
    ...safeArray(technical.databases),
    ...safeArray(technical.tools),
    ...safeArray(technical.cloudPlatforms),
    ...safeArray(technical.operatingSystems),
    ...safeArray(technical.methodologies)
  ].filter(Boolean).map(skill => ({
    name: safeString(skill),
    level: 'Advanced', // Default level
    years: 1
  }));

  return {
    // Basic Information
    name: safeString(personalInfo.fullName || personalInfo.firstName + ' ' + personalInfo.lastName),
    email: safeString(personalInfo.email),
    phone: safeString(personalInfo.phone),
    location: safeString(personalInfo.address?.city || personalInfo.address?.state || ''),
    
    // Social Profiles
    linkedinUrl: safeString(personalInfo.socialProfiles?.linkedin),
    portfolioUrl: safeString(personalInfo.socialProfiles?.portfolio || personalInfo.socialProfiles?.github),
    
    // Professional Summary
    summary: safeString(personalInfo.summary || personalInfo.objective),
    
    // Skills
    skills: {
      technical: technicalSkills,
      soft: safeArray(skills.soft).map(skill => safeString(skill)).filter(Boolean)
    },
    
    // Work Experience (Enhanced)
    experience: workExp.map(exp => ({
      title: safeString(exp.position),
      company: safeString(exp.company),
      location: safeString(exp.location),
      startDate: exp.startDate ? new Date(exp.startDate) : null,
      endDate: exp.endDate && exp.endDate !== 'present' ? new Date(exp.endDate) : null,
      description: safeString([
        ...safeArray(exp.responsibilities),
        ...safeArray(exp.achievements)
      ].join('. ')),
      technologies: safeArray(exp.technologies),
      isCurrentJob: Boolean(exp.isCurrentJob),
      teamSize: safeString(exp.teamSize),
      duration: safeString(exp.duration)
    })),
    
    // Education (Enhanced)
    education: education.map(ed => ({
      institution: safeString(ed.institution),
      degree: safeString(ed.degree),
      fieldOfStudy: safeString(ed.fieldOfStudy),
      startDate: ed.startDate ? new Date(ed.startDate) : null,
      endDate: ed.endDate || ed.graduationDate ? new Date(ed.endDate || ed.graduationDate) : null,
      gpa: safeString(ed.gpa),
      coursework: safeArray(ed.coursework),
      honors: safeArray(ed.honors)
    })),
    
    // Current Position
    currentPosition: {
      title: safeString(aiData.professionalSummary?.currentRole || workExp[0]?.position),
      company: safeString(workExp[0]?.company)
    },
    
    // Certifications (Enhanced)
    certifications: certifications.map(cert => {
      if (typeof cert === 'string') {
        return { name: safeString(cert), issuer: '', dateObtained: null };
      }
      return {
        name: safeString(cert.name),
        issuer: safeString(cert.issuer),
        dateObtained: cert.dateObtained ? new Date(cert.dateObtained) : null,
        expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
        credentialId: safeString(cert.credentialId)
      };
    }),
    
    // Projects (Enhanced)
    projects: projects.map(proj => ({
      name: safeString(proj.name),
      description: safeString(proj.description),
      technologies: safeArray(proj.technologies),
      url: safeString(proj.url),
      role: safeString(proj.role),
      achievements: safeArray(proj.achievements)
    })),
    
    // Additional Information
    additionalInfo: {
      totalExperience: safeString(aiData.professionalSummary?.totalExperience),
      careerLevel: safeString(aiData.professionalSummary?.careerLevel),
      availability: safeString(additionalInfo.availability),
      noticePeriod: safeString(additionalInfo.noticePeriod),
      expectedSalary: safeString(additionalInfo.expectedSalary),
      willingToRelocate: safeString(additionalInfo.willingToRelocate),
      visaStatus: safeString(additionalInfo.visaStatus),
      languages: safeArray(skills.languages),
      achievements: safeArray(aiData.achievements),
      publications: safeArray(aiData.publications),
      volunteering: safeArray(aiData.volunteering),
      hobbies: safeArray(additionalInfo.hobbies),
      interests: safeArray(additionalInfo.interests)
    }
  };
}

async function processResume(buffer, mimeType, originalName = '') {
  try {
    // Extract and clean text
    const rawText = await extractRawText(buffer, mimeType, originalName);
    
    if (!rawText || rawText.trim().length < 20) {
      throw new Error('Could not extract sufficient text from resume');
    }

    logger.info(`[resumeParser] Extracted ${rawText.length} characters from resume`);
    
    // Analyze with enhanced AI
    const aiProfile = await analyzeWithAI(rawText, true);
    
    // Map to candidate format
    const candidate = mapAiProfileToCandidate(aiProfile);
    
    logger.info(`[resumeParser] Successfully parsed resume for: ${candidate.name}`);
    
    return candidate;
    
  } catch (error) {
    logger.error(`[resumeParser] Processing failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  processResume,
  extractRawText,
  analyzeWithAI,
  mapAiProfileToCandidate
};