const { LangChainResumeParser } = require('./langchainResumeParser');
const logger = require('../utils/logger');

class EnhancedResumeParserService {
  constructor() {
    this.langchainParser = new LangChainResumeParser();
  }

  /**
   * Main method to process resume using LangChain GPT-4
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME type of the file
   * @param {string} originalName - Original filename
   * @returns {Object} Parsed candidate data
   */
  async processResume(buffer, mimeType, originalName = '') {
    try {
      logger.info(`[EnhancedResumeParser] Processing resume: ${originalName}`);
      
      // Use LangChain parser for structured extraction
      const structuredData = await this.langchainParser.parseResume(buffer, mimeType, originalName);
      
      // Convert to your existing candidate format
      const candidateData = this.langchainParser.mapToCandidate(structuredData);
      
      // Additional post-processing and validation
      const enhancedCandidate = this.postProcessCandidate(candidateData, structuredData);
      
      logger.info(`[EnhancedResumeParser] Successfully processed resume for: ${enhancedCandidate.name}`);
      
      return {
        candidate: enhancedCandidate,
        rawStructuredData: structuredData, // Keep original structured data for debugging
        metadata: {
          processingMethod: 'langchain-gpt4',
          timestamp: new Date().toISOString(),
          originalFilename: originalName,
          mimeType
        }
      };
      
    } catch (error) {
      logger.error(`[EnhancedResumeParser] Processing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Post-process candidate data for additional enhancements
   */
  postProcessCandidate(candidateData, structuredData) {
    // Ensure required fields have defaults
    const enhanced = {
      ...candidateData,
      name: candidateData.name || 'Unknown Candidate',
      email: candidateData.email || null,
      phone: candidateData.phone || null,
      location: candidateData.location || null,
      summary: candidateData.summary || null,
      skills: {
        technical: candidateData.skills?.technical || [],
        soft: candidateData.skills?.soft || []
      },
      experience: candidateData.experience || [],
      education: candidateData.education || [],
      certifications: candidateData.certifications || [],
      projects: candidateData.projects || [],
      additionalInfo: candidateData.additionalInfo || {}
    };

    // Calculate experience metrics
    enhanced.experienceMetrics = this.calculateExperienceMetrics(enhanced.experience);
    
    // Enhance skills with categories and proficiency
    enhanced.skills.technical = this.categorizeAndEnhanceSkills(enhanced.skills.technical);
    
    // Add career progression analysis
    enhanced.careerProgression = this.analyzeCareerProgression(enhanced.experience);
    
    // Extract key achievements with metrics
    enhanced.keyAchievements = this.extractKeyAchievements(enhanced.experience);
    
    return enhanced;
  }

  /**
   * Calculate experience metrics
   */
  calculateExperienceMetrics(experience) {
    if (!experience || experience.length === 0) {
      return {
        totalYears: 0,
        totalMonths: 0,
        numberOfRoles: 0,
        averageRoleDuration: '0 mo',
        longestRole: null,
        currentRole: null
      };
    }

    let totalMonths = 0;
    let longestRoleMonths = 0;
    let longestRole = null;
    let currentRole = null;

    experience.forEach(exp => {
      const startDate = exp.startDate ? new Date(exp.startDate) : null;
      const endDate = exp.endDate ? new Date(exp.endDate) : new Date();
      
      if (startDate) {
        const months = this.diffInMonths(startDate, endDate);
        totalMonths += months;
        
        if (months > longestRoleMonths) {
          longestRoleMonths = months;
          longestRole = exp;
        }
        
        if (exp.isCurrentJob) {
          currentRole = exp;
        }
      }
    });

    const totalYears = Math.round((totalMonths / 12) * 10) / 10;
    const avgMonths = Math.round(totalMonths / experience.length);

    return {
      totalYears,
      totalMonths,
      numberOfRoles: experience.length,
      averageRoleDuration: this.humanDurationFromMonths(avgMonths),
      longestRole: longestRole ? {
        title: longestRole.title,
        company: longestRole.company,
        duration: longestRole.duration
      } : null,
      currentRole: currentRole ? {
        title: currentRole.title,
        company: currentRole.company,
        duration: currentRole.duration
      } : null
    };
  }

  /**
   * Categorize and enhance technical skills
   */
  categorizeAndEnhanceSkills(technicalSkills) {
    const categories = {
      programmingLanguages: [],
      frameworks: [],
      databases: [],
      cloudPlatforms: [],
      tools: [],
      other: []
    };

    const languageKeywords = ['javascript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'typescript', 'c++', 'c', 'scala', 'r', 'matlab'];
    const frameworkKeywords = ['react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'asp.net', 'next.js', 'nuxt'];
    const databaseKeywords = ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sql server', 'sqlite', 'cassandra', 'dynamodb'];
    const cloudKeywords = ['aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'jenkins', 'gitlab'];
    const toolKeywords = ['git', 'jira', 'confluence', 'slack', 'figma', 'photoshop', 'illustrator', 'postman', 'insomnia'];

    technicalSkills.forEach(skill => {
      const skillName = (typeof skill === 'string' ? skill : skill.name || '').toLowerCase();
      const skillObj = typeof skill === 'object' ? skill : { name: skill, years: 0, level: 'Beginner' };

      if (languageKeywords.some(keyword => skillName.includes(keyword))) {
        categories.programmingLanguages.push(skillObj);
      } else if (frameworkKeywords.some(keyword => skillName.includes(keyword))) {
        categories.frameworks.push(skillObj);
      } else if (databaseKeywords.some(keyword => skillName.includes(keyword))) {
        categories.databases.push(skillObj);
      } else if (cloudKeywords.some(keyword => skillName.includes(keyword))) {
        categories.cloudPlatforms.push(skillObj);
      } else if (toolKeywords.some(keyword => skillName.includes(keyword))) {
        categories.tools.push(skillObj);
      } else {
        categories.other.push(skillObj);
      }
    });

    return categories;
  }

  /**
   * Analyze career progression
   */
  analyzeCareerProgression(experience) {
    if (!experience || experience.length === 0) {
      return {
        trend: 'unknown',
        progressionScore: 0,
        roleChanges: 0,
        companyChanges: 0,
        titleProgression: []
      };
    }

    // Sort by start date
    const sortedExp = experience
      .filter(exp => exp.startDate)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    const titleProgression = sortedExp.map(exp => ({
      title: exp.title,
      company: exp.company,
      startDate: exp.startDate,
      level: this.inferSeniorityLevel(exp.title)
    }));

    const roleChanges = sortedExp.length - 1;
    const companyChanges = new Set(sortedExp.map(exp => exp.company)).size - 1;

    // Calculate progression score based on title seniority
    let progressionScore = 0;
    for (let i = 1; i < titleProgression.length; i++) {
      const prevLevel = titleProgression[i - 1].level;
      const currLevel = titleProgression[i].level;
      if (currLevel > prevLevel) progressionScore += 1;
      else if (currLevel < prevLevel) progressionScore -= 0.5;
    }

    const trend = progressionScore > 0 ? 'upward' : progressionScore < 0 ? 'downward' : 'stable';

    return {
      trend,
      progressionScore,
      roleChanges,
      companyChanges,
      titleProgression
    };
  }

  /**
   * Infer seniority level from job title
   */
  inferSeniorityLevel(title) {
    const titleLower = (title || '').toLowerCase();
    
    if (titleLower.includes('intern') || titleLower.includes('trainee')) return 1;
    if (titleLower.includes('junior') || titleLower.includes('associate') || titleLower.includes('entry')) return 2;
    if (titleLower.includes('senior') || titleLower.includes('sr.')) return 4;
    if (titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff')) return 5;
    if (titleLower.includes('manager') || titleLower.includes('head')) return 6;
    if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('vice president')) return 7;
    if (titleLower.includes('cto') || titleLower.includes('ceo') || titleLower.includes('chief')) return 8;
    
    return 3; // Mid-level default
  }

  /**
   * Extract key achievements with metrics
   */
  extractKeyAchievements(experience) {
    const achievements = [];
    
    experience.forEach(exp => {
      (exp.achievements || []).forEach(achievement => {
        const metrics = this.extractMetricsFromText(achievement);
        if (metrics.length > 0) {
          achievements.push({
            description: achievement,
            company: exp.company,
            role: exp.title,
            metrics: metrics,
            impact: this.categorizeImpact(achievement)
          });
        }
      });
    });

    // Sort by impact and return top achievements
    return achievements
      .sort((a, b) => b.metrics.length - a.metrics.length)
      .slice(0, 10);
  }

  /**
   * Extract numeric metrics from text
   */
  extractMetricsFromText(text) {
    const metrics = [];
    const patterns = [
      /(\d+(?:\.\d+)?)\s*%/g, // Percentages
      /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, // Money
      /(\d+(?:,\d{3})*)\s*(?:users|customers|clients|people|employees)/gi, // User counts
      /(\d+(?:\.\d+)?)\s*(?:x|times)/gi, // Multipliers
      /(\d+(?:,\d{3})*)\s*(?:hours|days|weeks|months)/gi // Time savings
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        metrics.push({
          value: match[1],
          type: this.getMetricType(match[0]),
          context: text.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20)
        });
      }
    });

    return metrics;
  }

  /**
   * Get metric type from matched text
   */
  getMetricType(matchedText) {
    if (matchedText.includes('%')) return 'percentage';
    if (matchedText.includes('$')) return 'monetary';
    if (/users|customers|clients|people|employees/i.test(matchedText)) return 'user_count';
    if (/x|times/i.test(matchedText)) return 'multiplier';
    if (/hours|days|weeks|months/i.test(matchedText)) return 'time';
    return 'numeric';
  }

  /**
   * Categorize impact level
   */
  categorizeImpact(achievement) {
    const text = achievement.toLowerCase();
    
    if (text.includes('led') || text.includes('managed') || text.includes('directed')) return 'leadership';
    if (text.includes('improved') || text.includes('increased') || text.includes('enhanced')) return 'improvement';
    if (text.includes('reduced') || text.includes('decreased') || text.includes('optimized')) return 'optimization';
    if (text.includes('built') || text.includes('developed') || text.includes('created')) return 'creation';
    if (text.includes('implemented') || text.includes('deployed') || text.includes('launched')) return 'implementation';
    
    return 'general';
  }

  // Utility methods
  diffInMonths(startDate, endDate) {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    
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
}

module.exports = { EnhancedResumeParserService };
