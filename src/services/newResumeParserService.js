const { EnhancedResumeParserService } = require('./enhancedResumeParserService');
const logger = require('../utils/logger');

// This replaces your existing resumeParserService.js with LangChain GPT-4 implementation
class NewResumeParserService {
  constructor() {
    this.enhancedParser = new EnhancedResumeParserService();
  }

  /**
   * Main entry point - replaces processResume from original service
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} originalName - Original filename
   * @returns {Object} Candidate data in your existing format
   */
  async processResume(buffer, mimeType, originalName = '') {
    try {
      logger.info(`[NewResumeParser] Processing resume: ${originalName}`);
      
      // Use enhanced LangChain parser
      const result = await this.enhancedParser.processResume(buffer, mimeType, originalName);
      
      // Return just the candidate data to maintain compatibility with existing code
      return result.candidate;
      
    } catch (error) {
      logger.error(`[NewResumeParser] Processing failed: ${error.message}`);
      
      // Fallback to basic extraction if LangChain fails
      try {
        logger.info('[NewResumeParser] Attempting fallback extraction...');
        return await this.fallbackExtraction(buffer, mimeType, originalName);
      } catch (fallbackError) {
        logger.error(`[NewResumeParser] Fallback also failed: ${fallbackError.message}`);
        throw error; // Throw original error
      }
    }
  }

  /**
   * Fallback extraction method using simpler approach
   */
  async fallbackExtraction(buffer, mimeType, originalName) {
    const pdfParse = require('pdf-parse');
    const mammoth = require('mammoth');
    const path = require('path');

    let rawText = '';
    
    try {
      const ext = path.extname(originalName || '').toLowerCase();
      
      if (mimeType === 'application/pdf' || ext === '.pdf') {
        const data = await pdfParse(buffer);
        rawText = data.text || '';
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value || '';
      } else {
        rawText = buffer.toString('utf8');
      }

      // Basic text extraction and simple parsing
      return this.basicTextParsing(rawText, originalName);
      
    } catch (error) {
      logger.error(`[NewResumeParser] Fallback extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Basic text parsing as last resort
   */
  basicTextParsing(text, filename) {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    // Extract basic information using regex patterns
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/[\+]?[1-9]?[\d\s\-\(\)]{10,}/);
    
    // Try to find name (usually first non-empty line or line before email)
    let name = 'Unknown Candidate';
    if (lines.length > 0) {
      name = lines[0];
      // If first line looks like a header/title, try second line
      if (lines[0].toLowerCase().includes('resume') || lines[0].toLowerCase().includes('cv')) {
        name = lines[1] || name;
      }
    }

    // Extract skills (look for common skill keywords)
    const skillKeywords = ['javascript', 'python', 'java', 'react', 'node', 'sql', 'aws', 'docker', 'git'];
    const foundSkills = skillKeywords.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );

    return {
      name: name,
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, '') : null,
      location: null,
      linkedinUrl: null,
      portfolioUrl: null,
      summary: null,
      skills: {
        technical: foundSkills.map(skill => ({
          name: skill,
          level: 'Intermediate',
          years: 1
        })),
        soft: []
      },
      experience: [],
      education: [],
      currentPosition: {
        title: null,
        company: null
      },
      certifications: [],
      projects: [],
      additionalInfo: {
        totalExperience: null,
        careerLevel: null,
        availability: null,
        noticePeriod: null,
        expectedSalary: null,
        willingToRelocate: null,
        visaStatus: null,
        languages: [],
        achievements: [],
        publications: [],
        volunteering: [],
        hobbies: [],
        interests: []
      }
    };
  }

  /**
   * Get detailed parsing result with metadata (optional method for debugging)
   */
  async processResumeDetailed(buffer, mimeType, originalName = '') {
    return await this.enhancedParser.processResume(buffer, mimeType, originalName);
  }

  /**
   * Extract raw text only (utility method)
   */
  async extractRawText(buffer, mimeType, filename = '') {
    return await this.enhancedParser.langchainParser.extractRawText(buffer, mimeType, filename);
  }

  /**
   * Analyze with AI only (utility method)
   */
  async analyzeWithAI(rawText) {
    return await this.enhancedParser.langchainParser.parseResume(Buffer.from(rawText), 'text/plain', 'text.txt');
  }
}

// Export both the class and a default instance for backward compatibility
const newResumeParserService = new NewResumeParserService();

module.exports = {
  NewResumeParserService,
  processResume: (buffer, mimeType, originalName) => newResumeParserService.processResume(buffer, mimeType, originalName),
  extractRawText: (buffer, mimeType, filename) => newResumeParserService.extractRawText(buffer, mimeType, filename),
  analyzeWithAI: (rawText) => newResumeParserService.analyzeWithAI(rawText)
};
