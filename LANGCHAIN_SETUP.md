# LangChain Resume Parser Setup Guide

## Overview
Your resume parser has been upgraded to use LangChain with GPT-4 for more accurate and structured extraction of resume data. This provides better parsing of:

- Years of experience per skill
- Detailed work experience with responsibilities vs achievements
- Accurate date parsing and duration calculations
- Enhanced skill categorization
- Career progression analysis
- Quantified achievements extraction

## Files Added

### Core Parser Files
- `src/services/langchainResumeParser.js` - Main LangChain parser with Zod schema
- `src/services/enhancedResumeParserService.js` - Enhanced processing with metrics
- `src/services/newResumeParserService.js` - Drop-in replacement for existing parser

### Integration
- Updated `src/controllers/candidateController.js` to use new parser

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install
```

New dependencies added:
- `@langchain/openai` - OpenAI integration for LangChain
- `@langchain/core` - Core LangChain functionality  
- `langchain` - Main LangChain library
- `zod` - Schema validation for structured output

### 2. Environment Configuration
Add to your `server/.env` file:

```env
# OpenAI API Key for LangChain (required)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Model configuration
LANGCHAIN_MODEL=gpt-4-turbo-preview
LANGCHAIN_TEMPERATURE=0.1
LANGCHAIN_MAX_TOKENS=4000
```

### 3. Test the New Parser

#### Basic Test
```javascript
const { processResume } = require('./src/services/newResumeParserService');

// Test with a resume file
const fs = require('fs');
const buffer = fs.readFileSync('path/to/resume.pdf');
const result = await processResume(buffer, 'application/pdf', 'resume.pdf');
console.log(JSON.stringify(result, null, 2));
```

#### Detailed Test (with metadata)
```javascript
const { NewResumeParserService } = require('./src/services/newResumeParserService');

const parser = new NewResumeParserService();
const detailedResult = await parser.processResumeDetailed(buffer, 'application/pdf', 'resume.pdf');

console.log('Candidate Data:', detailedResult.candidate);
console.log('Raw Structured Data:', detailedResult.rawStructuredData);
console.log('Metadata:', detailedResult.metadata);
```

## Key Improvements

### 1. Structured Data Extraction
The new parser uses Zod schemas to ensure consistent, validated output:

```javascript
// Example output structure
{
  personalInfo: {
    fullName: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    address: { city: "New York", state: "NY" },
    socialProfiles: {
      linkedin: "https://linkedin.com/in/johndoe",
      github: "https://github.com/johndoe"
    }
  },
  workExperience: [{
    company: "Tech Corp",
    position: "Senior Developer",
    startDate: "2020-01-01",
    endDate: "2023-12-31",
    duration: "4 yrs",
    responsibilities: ["Led development team", "Architected solutions"],
    achievements: ["Increased performance by 30%", "Reduced bugs by 50%"],
    technologies: ["React", "Node.js", "AWS"]
  }],
  skills: {
    technical: {
      programmingLanguages: [
        { name: "JavaScript", years: 4.2, level: "Advanced" },
        { name: "Python", years: 2.1, level: "Intermediate" }
      ]
    }
  }
}
```

### 2. Enhanced Skill Analysis
- **Years per skill**: Calculated from role durations where skill was used
- **Skill levels**: Automatically assigned (Beginner/Intermediate/Advanced)
- **Skill categorization**: Programming languages, frameworks, databases, etc.

### 3. Career Progression Analysis
```javascript
{
  experienceMetrics: {
    totalYears: 4.2,
    numberOfRoles: 3,
    averageRoleDuration: "1 yr 4 mos"
  },
  careerProgression: {
    trend: "upward",
    progressionScore: 2,
    titleProgression: [
      { title: "Junior Developer", level: 2 },
      { title: "Developer", level: 3 },
      { title: "Senior Developer", level: 4 }
    ]
  }
}
```

### 4. Achievement Extraction
Automatically finds and categorizes quantified achievements:

```javascript
{
  keyAchievements: [{
    description: "Improved application performance by 30%",
    metrics: [{ value: "30", type: "percentage" }],
    impact: "improvement"
  }]
}
```

## Fallback Strategy

The new parser includes multiple fallback levels:

1. **Primary**: LangChain + GPT-4 structured extraction
2. **Secondary**: Basic text extraction with regex patterns
3. **Tertiary**: Simple keyword matching

This ensures your application continues working even if OpenAI API is unavailable.

## API Compatibility

The new parser is a drop-in replacement. Your existing API endpoints will work without changes:

```javascript
// This still works exactly the same
const candidate = await processResume(buffer, mimeType, filename);
```

## Performance Considerations

- **Processing time**: 3-8 seconds per resume (depending on length)
- **Cost**: ~$0.01-0.05 per resume (GPT-4 pricing)
- **Rate limits**: Respects OpenAI rate limits
- **Caching**: Consider caching results for identical files

## Monitoring and Debugging

### Enable Detailed Logging
```javascript
// In your environment
DEBUG=langchain*
LOG_LEVEL=debug
```

### Error Handling
```javascript
try {
  const result = await processResume(buffer, mimeType, filename);
} catch (error) {
  console.error('Resume parsing failed:', error.message);
  // Fallback logic is automatically handled
}
```

## Testing with Your Resume

Based on your resume example (Prince Kumar), the new parser should extract:

- **Personal Info**: Name, email (princerajputana5@gmail.com), phone, location (Noida, India)
- **Experience**: 
  - UI Engineer at Auriga It Pvt. Ltd. (May 2022 – Present)
  - Frontend Developer at La Majeste Industries (Sept 2021 – April 2022)
  - Associate Frontend Developer at Seventh Sq. (Feb 2021 – Aug 2021)
- **Skills with Years**:
  - React.js: ~2.5 years (Advanced)
  - JavaScript: ~2.5 years (Advanced)
  - Node.js: ~2 years (Intermediate)
- **Education**: Rajasthan Technical University, B-Tech Computer Science
- **Achievements**: Performance improvements, cross-browser compatibility, etc.

## Next Steps

1. Set up your OpenAI API key
2. Install dependencies: `npm install`
3. Test with a sample resume
4. Deploy and monitor performance
5. Consider adding custom post-processing for your specific needs

## Support

If you encounter issues:
1. Check OpenAI API key is valid
2. Verify dependencies are installed
3. Check logs for detailed error messages
4. Test with different resume formats (PDF, DOCX)

The parser is designed to be robust and handle various resume formats and styles.
