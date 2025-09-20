const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StructuredOutputParser, OutputFixingParser } = require('langchain/output_parsers');
const { z } = require('zod');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const logger = require('../utils/logger');

// Enhanced Zod schema for structured resume parsing
const ResumeSchema = z.object({
  personalInfo: z.object({
    fullName: z.string().describe('Complete full name of the candidate'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional().describe('Primary email address'),
    phone: z.string().optional().describe('Primary phone number'),
    alternatePhone: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional()
    }).optional(),
    socialProfiles: z.object({
      linkedin: z.string().url().optional(),
      github: z.string().url().optional(),
      portfolio: z.string().url().optional(),
      twitter: z.string().url().optional(),
      other: z.array(z.string()).optional()
    }).optional(),
    summary: z.string().optional().describe('Professional summary or objective'),
    objective: z.string().optional()
  }),
  
  professionalSummary: z.object({
    totalExperience: z.string().optional().describe('Total years of experience (e.g., "4+ years")'),
    currentRole: z.string().optional(),
    industryExperience: z.array(z.string()).optional(),
    careerLevel: z.enum(['Entry', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP', 'C-Level']).optional()
  }),
  
  workExperience: z.array(z.object({
    company: z.string().describe('Company name'),
    position: z.string().describe('Job title/position'),
    location: z.string().optional(),
    startDate: z.string().describe('Start date in any format'),
    endDate: z.string().optional().describe('End date or "Present" if current'),
    isCurrentJob: z.boolean().optional(),
    duration: z.string().optional().describe('Duration like "2 yrs 3 mos"'),
    responsibilities: z.array(z.string()).describe('List of job responsibilities'),
    achievements: z.array(z.string()).describe('Quantifiable achievements with metrics'),
    technologies: z.array(z.string()).describe('Technologies/tools used in this role'),
    teamSize: z.string().optional(),
    reportingTo: z.string().optional()
  })),
  
  education: z.array(z.object({
    institution: z.string().describe('School/University name'),
    degree: z.string().describe('Degree type (Bachelor, Master, etc.)'),
    fieldOfStudy: z.string().optional().describe('Major/field of study'),
    location: z.string().optional(),
    graduationDate: z.string().optional(),
    gpa: z.string().optional(),
    coursework: z.array(z.string()).optional(),
    honors: z.array(z.string()).optional(),
    activities: z.array(z.string()).optional()
  })),
  
  skills: z.object({
    technical: z.object({
      programmingLanguages: z.array(z.string()).optional(),
      frameworks: z.array(z.string()).optional(),
      databases: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
      cloudPlatforms: z.array(z.string()).optional(),
      operatingSystems: z.array(z.string()).optional(),
      methodologies: z.array(z.string()).optional()
    }),
    soft: z.array(z.string()).optional().describe('Soft skills like leadership, communication'),
    languages: z.array(z.object({
      language: z.string(),
      proficiency: z.enum(['Basic', 'Conversational', 'Fluent', 'Native']).optional()
    })).optional()
  }),
  
  certifications: z.array(z.object({
    name: z.string().describe('Certification name'),
    issuer: z.string().optional().describe('Issuing organization'),
    dateObtained: z.string().optional(),
    expiryDate: z.string().optional(),
    credentialId: z.string().optional()
  })),
  
  projects: z.array(z.object({
    name: z.string().describe('Project name'),
    description: z.string().describe('Project description'),
    technologies: z.array(z.string()).describe('Technologies used'),
    duration: z.string().optional(),
    role: z.string().optional().describe('Your role in the project'),
    achievements: z.array(z.string()).optional(),
    url: z.string().url().optional()
  })),
  
  achievements: z.array(z.object({
    title: z.string(),
    description: z.string(),
    date: z.string().optional(),
    category: z.string().optional()
  })),
  
  publications: z.array(z.object({
    title: z.string(),
    journal: z.string().optional(),
    date: z.string().optional(),
    authors: z.array(z.string()).optional(),
    url: z.string().url().optional()
  })),
  
  volunteering: z.array(z.object({
    organization: z.string(),
    role: z.string(),
    duration: z.string().optional(),
    description: z.string().optional()
  })),
  
  additionalInfo: z.object({
    availability: z.string().optional(),
    noticePeriod: z.string().optional(),
    expectedSalary: z.string().optional(),
    willingToRelocate: z.string().optional(),
    visaStatus: z.string().optional(),
    references: z.array(z.string()).optional(),
    hobbies: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional()
  }).optional()
});

class LangChainResumeParser {
  constructor() {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview', // Use GPT-4 Turbo (closest to GPT-5 performance)
      temperature: 0.1, // Low temperature for consistent extraction
      maxTokens: 4000,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    // Create structured output parser
    this.parser = StructuredOutputParser.fromZodSchema(ResumeSchema);
    
    // Create fixing parser to handle malformed JSON
    this.fixingParser = OutputFixingParser.fromLLM(this.model, this.parser);
    
    // Create prompt template
    this.promptTemplate = PromptTemplate.fromTemplate(`
You are an expert resume analyzer with deep understanding of professional documents. 
Extract EVERY possible detail from the resume text with maximum precision and completeness.

CRITICAL INSTRUCTIONS:
1. Extract ALL information present, even if partially mentioned or implied
2. For missing fields, omit them entirely (don't use empty strings or arrays)
3. Infer logical details when context allows (e.g., seniority level from job titles)
4. Parse dates in various formats (Jan 2020, 01/2020, January 2020, etc.)
5. Separate responsibilities (daily tasks) from achievements (measurable results with numbers/percentages)
6. Identify ALL technical skills mentioned throughout (job descriptions, projects, etc.)
7. Extract soft skills from context (leadership experience → leadership skill)
8. Parse company information and role context thoroughly
9. Extract education details including GPA, coursework, honors if mentioned
10. Look for certifications, licenses, publications, volunteering activities
11. Find salary expectations, availability, visa status if mentioned
12. Extract contact information and social profiles completely
13. Identify projects with technologies used and specific achievements
14. Parse languages spoken and proficiency levels
15. When dates are present for roles, mark isCurrentJob if end date is present/current
16. Extract quantifiable achievements with specific metrics (percentages, numbers, etc.)

RESUME TEXT TO ANALYZE:
{resumeText}

{format_instructions}

Extract comprehensive structured data (return only the structured output):
    `);
  }

  // Text extraction methods (reuse from existing service)
  async extractFromPdf(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (error) {
      logger.error(`[LangChainParser] PDF extraction failed: ${error.message}`);
      throw error;
    }
  }

  async extractFromDocx(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      logger.error(`[LangChainParser] DOCX extraction failed: ${error.message}`);
      throw error;
    }
  }

  cleanResumeText(rawText) {
    return rawText
      .replace(/\s+/g, ' ')           // normalize whitespace
      .replace(/[^\x20-\x7E\n]/g, '') // remove non-ASCII except newlines
      .replace(/\n\s*\n/g, '\n')      // remove extra line breaks
      .trim();
  }

  async extractRawText(buffer, mimeType, filename = '') {
    try {
      let rawText = '';
      
      const ext = path.extname(filename || '').toLowerCase();
      
      if (mimeType === 'application/pdf' || ext === '.pdf') {
        rawText = await this.extractFromPdf(buffer);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
        rawText = await this.extractFromDocx(buffer);
      } else {
        // Treat as text
        rawText = buffer.toString('utf8');
      }

      return this.cleanResumeText(rawText);
    } catch (error) {
      logger.error(`[LangChainParser] Text extraction failed: ${error.message}`);
      throw error;
    }
  }

  // Enhanced date parsing utilities
  parseDateFlexible(input) {
    if (!input) return null;
    
    const s = String(input)
      .replace(/\b(present|current)\b/i, new Date().toISOString())
      .replace(/\bsept\b/i, 'Sep')
      .trim();
    
    // Try native Date first
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    
    // Try common formats
    const patterns = [
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.-]*([0-9]{4})/i,
      /([0-9]{1,2})[\/\-]([0-9]{4})/,
      /([0-9]{4})[\/\-]([0-9]{1,2})/
    ];
    
    for (const pattern of patterns) {
      const match = s.match(pattern);
      if (match) {
        try {
          return new Date(`${match[1]} 1, ${match[2]}`);
        } catch (e) {
          continue;
        }
      }
    }
    
    return null;
  }

  diffInMonths(startDate, endDate) {
    const start = startDate instanceof Date ? startDate : this.parseDateFlexible(startDate);
    const end = endDate ? (endDate instanceof Date ? endDate : this.parseDateFlexible(endDate)) : new Date();
    
    if (!start || !end) return 0;
    
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(0, months);
  }

  humanDurationFromMonths(months) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const parts = [];
    
    if (years) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
    if (remainingMonths) parts.push(`${remainingMonths} mo${remainingMonths > 1 ? 's' : ''}`);
    
    return parts.length ? parts.join(' ') : '0 mo';
  }

  // Main parsing method
  async parseResume(buffer, mimeType, originalName = '') {
    try {
      logger.info('[LangChainParser] Starting resume parsing...');
      
      // Extract raw text
      const rawText = await this.extractRawText(buffer, mimeType, originalName);
      
      if (!rawText || rawText.trim().length < 20) {
        throw new Error('Could not extract sufficient text from resume');
      }

      logger.info(`[LangChainParser] Extracted ${rawText.length} characters from resume`);
      
      // Create the prompt
      const formatInstructions = this.parser.getFormatInstructions();
      const prompt = await this.promptTemplate.format({
        resumeText: rawText,
        format_instructions: formatInstructions
      });

      // Get structured output from LLM
      logger.info('[LangChainParser] Sending to GPT-4 for structured extraction...');
      const response = await this.model.invoke(prompt);
      
      // Parse the structured output
      const parsedData = await this.fixingParser.parse(response.content);
      
      // Post-process and enhance the data
      const enhancedData = this.enhanceExtractedData(parsedData);
      
      logger.info(`[LangChainParser] Successfully parsed resume for: ${enhancedData.personalInfo?.fullName || 'Unknown'}`);
      
      return enhancedData;
      
    } catch (error) {
      logger.error(`[LangChainParser] Parsing failed: ${error.message}`);
      throw error;
    }
  }

  // Post-processing to enhance extracted data
  enhanceExtractedData(data) {
    // Calculate durations for work experience
    if (data.workExperience) {
      data.workExperience = data.workExperience.map(exp => {
        const startDate = this.parseDateFlexible(exp.startDate);
        const endDate = exp.endDate && !/(present|current)/i.test(exp.endDate) 
          ? this.parseDateFlexible(exp.endDate) 
          : null;
        
        const months = this.diffInMonths(startDate, endDate);
        
        return {
          ...exp,
          startDate: startDate?.toISOString() || exp.startDate,
          endDate: endDate?.toISOString() || exp.endDate,
          duration: exp.duration || this.humanDurationFromMonths(months),
          isCurrentJob: exp.isCurrentJob || /(present|current)/i.test(exp.endDate || ''),
          calculatedMonths: months
        };
      });
    }

    // Calculate total experience
    if (data.workExperience && !data.professionalSummary?.totalExperience) {
      const totalMonths = data.workExperience.reduce((sum, exp) => sum + (exp.calculatedMonths || 0), 0);
      if (!data.professionalSummary) data.professionalSummary = {};
      data.professionalSummary.totalExperience = this.humanDurationFromMonths(totalMonths);
    }

    // Enhance skills with experience-based years
    if (data.skills?.technical && data.workExperience) {
      const skillMonths = new Map();
      
      data.workExperience.forEach(exp => {
        const months = exp.calculatedMonths || 0;
        (exp.technologies || []).forEach(tech => {
          const key = tech.toLowerCase().trim();
          skillMonths.set(key, (skillMonths.get(key) || 0) + months);
        });
      });

      // Add years to technical skills
      Object.keys(data.skills.technical).forEach(category => {
        if (Array.isArray(data.skills.technical[category])) {
          data.skills.technical[category] = data.skills.technical[category].map(skill => {
            const months = skillMonths.get(skill.toLowerCase().trim()) || 0;
            const years = Math.round((months / 12) * 10) / 10;
            return {
              name: skill,
              years: years,
              level: years >= 3 ? 'Advanced' : years >= 1 ? 'Intermediate' : 'Beginner'
            };
          });
        }
      });
    }

    return data;
  }

  // Convert to your existing candidate format
  mapToCandidate(parsedData) {
    const personalInfo = parsedData.personalInfo || {};
    const skills = parsedData.skills || {};
    const workExp = parsedData.workExperience || [];
    const education = parsedData.education || [];
    const projects = parsedData.projects || [];
    const certifications = parsedData.certifications || [];
    const additionalInfo = parsedData.additionalInfo || {};

    // Flatten technical skills
    const technicalSkills = [];
    if (skills.technical) {
      Object.values(skills.technical).forEach(skillArray => {
        if (Array.isArray(skillArray)) {
          technicalSkills.push(...skillArray);
        }
      });
    }

    return {
      // Basic Information
      name: personalInfo.fullName || `${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`.trim(),
      email: personalInfo.email,
      phone: personalInfo.phone,
      location: personalInfo.address?.city || personalInfo.address?.state || '',
      
      // Social Profiles
      linkedinUrl: personalInfo.socialProfiles?.linkedin,
      portfolioUrl: personalInfo.socialProfiles?.portfolio || personalInfo.socialProfiles?.github,
      
      // Professional Summary
      summary: personalInfo.summary || personalInfo.objective,
      
      // Skills
      skills: {
        technical: technicalSkills,
        soft: skills.soft || []
      },
      
      // Work Experience
      experience: workExp.map(exp => ({
        title: exp.position,
        company: exp.company,
        location: exp.location,
        startDate: exp.startDate ? new Date(exp.startDate) : null,
        endDate: exp.endDate ? new Date(exp.endDate) : null,
        duration: exp.duration,
        isCurrentJob: exp.isCurrentJob,
        responsibilities: exp.responsibilities || [],
        achievements: exp.achievements || [],
        description: [...(exp.responsibilities || []), ...(exp.achievements || [])].join('. '),
        technologies: exp.technologies || [],
        teamSize: exp.teamSize
      })),
      
      // Education
      education: education.map(ed => ({
        institution: ed.institution,
        degree: ed.degree,
        fieldOfStudy: ed.fieldOfStudy,
        startDate: ed.startDate ? new Date(ed.startDate) : null,
        endDate: ed.graduationDate ? new Date(ed.graduationDate) : null,
        gpa: ed.gpa,
        coursework: ed.coursework || [],
        honors: ed.honors || []
      })),
      
      // Current Position
      currentPosition: {
        title: parsedData.professionalSummary?.currentRole || workExp[0]?.position,
        company: workExp[0]?.company
      },
      
      // Certifications
      certifications: certifications.map(cert => ({
        name: cert.name,
        issuer: cert.issuer,
        dateObtained: cert.dateObtained ? new Date(cert.dateObtained) : null,
        expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
        credentialId: cert.credentialId
      })),
      
      // Projects
      projects: projects.map(proj => ({
        name: proj.name,
        description: proj.description,
        technologies: proj.technologies || [],
        url: proj.url,
        role: proj.role,
        achievements: proj.achievements || []
      })),
      
      // Additional Information
      additionalInfo: {
        totalExperience: parsedData.professionalSummary?.totalExperience,
        careerLevel: parsedData.professionalSummary?.careerLevel,
        availability: additionalInfo.availability,
        noticePeriod: additionalInfo.noticePeriod,
        expectedSalary: additionalInfo.expectedSalary,
        willingToRelocate: additionalInfo.willingToRelocate,
        visaStatus: additionalInfo.visaStatus,
        languages: skills.languages || [],
        achievements: parsedData.achievements || [],
        publications: parsedData.publications || [],
        volunteering: parsedData.volunteering || [],
        hobbies: additionalInfo.hobbies || [],
        interests: additionalInfo.interests || []
      }
    };
  }
}

module.exports = { LangChainResumeParser, ResumeSchema };
