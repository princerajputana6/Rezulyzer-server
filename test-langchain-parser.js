const { NewResumeParserService } = require('./src/services/newResumeParserService');
const fs = require('fs');
const path = require('path');

// Test script for the new LangChain resume parser
async function testParser() {
  console.log('🚀 Testing LangChain Resume Parser...\n');

  const parser = new NewResumeParserService();

  // Test with sample resume text (based on Prince Kumar's resume)
  const sampleResumeText = `
Prince Kumar
Noida, India | princerajputana5@gmail.com | 8740863229 | Portfolio | linkedin.com/in/geeky-prince
github.com/princerajputana6

SUMMARY
Frontend Developer with 4+ years of experience building responsive, performant, and scalable web applications using React.js, Next.js, JavaScript, and Node.js. Proven ability to reduce load time by 30%, enhance user engagement by 25%, and lead development efficiency initiatives. Strong command of modern front-end ecosystems, UI/UX standards, and cross-functional team collaboration.

Technologies
Languages/Frameworks: JavaScript, TypeScript, React.js, Next.js, Node.js
UI Libraries: Tailwind CSS, Bootstrap, MUI, Styled Components
State Management: Redux, Context API
Cloud & DevOps: AWS (S3, EC2), Git, GitHub, Bitbucket, CI/CD (basic knowledge)
Database & Tools: MongoDB, Google Search Console, VS Code, Cursor, Windsurf
Development: SSR, SSG, REST APIs, Responsive Design, Cross-browser Compatibility

Experience
UI Engineer, Auriga It Pvt. Ltd. – Remote                                                    May 2022 – Present
• Reduced page load time by 20% by optimizing asset delivery and lazy loading in React apps.
• Ensured 100% cross-browser compatibility and accessibility compliance (WCAG 2.1) for enterprise clients.
• Implemented modern component-based architecture with React + TypeScript, reducing bug density by 15%.
• Increased feature delivery speed by 18% using modular design patterns and reusable components.
• Worked closely with stakeholders to iterate UI/UX, increasing mobile engagement by 25%.

Frontend Developer, La Majeste Industries Pvt. Ltd – Remote                        Sept 2021 – April 2022
• Delivered scalable UI systems resulting in a 20% boost in user satisfaction (measured via surveys).
• Implemented conversion-focused interfaces that increased lead-to-customer conversion by 12%.
• Introduced component reusability strategies, reducing development time by 15% per feature cycle.
• Evaluated and integrated front-end frameworks, streamlining the development pipeline.

Associate Frontend Developer, Seventh Sq. Pvt. Ltd. – Remote                      Feb 2021 – Aug 2021
• Collaborated directly with the CEO to deliver product features, cutting delivery time by 20%.
• Translated Figma designs into pixel-perfect, responsive interfaces using HTML, CSS, and JavaScript.
• Actively participated in the entire SDLC, contributing to fast-paced Agile delivery.

Projects & Certification
Personal Portfolio                                                                                Live URL
• Built my Personal Portfolio website using ReactJS, Three JS, Firebase, Nodemailer with great animations.
• Tools Used: ReactJS, Firebase, Three JS Tailwind Css

Dashboard Boilerplate                                                                        Github URL
• Built a Dashboard Boilerplate so if anyone who want to build admin dashboard with some basic functionality they can start from this and customize it.
• Tools Used: Reactjs, Firebase, MUI

Company Portfolio Website                                                                   Github URL
• Built a Portfolio Website for Geeky Prince Pvt. Ltd. having a slick UI and smooth animations.
• Tools Used: NextJs, Tailwind Css

ReactJS-Complete Guide                                                                    Certificate URL
• Successfully completed the course React JS- Complete Guide for Frontend Web Development on 08/25/2021 as taught by EdYoda for Business, Qaifi Khan, Mavludin Abdulkadirov on Udemy.
• Tools Used: ReactJs, JavaScript, Jquery, HTML, CSS

Education
Rajasthan Technical University, B-Tech in Computer Science                           Aug 2017 – Sep 2021
`;

  try {
    // Test 1: Basic parsing
    console.log('📄 Test 1: Basic Resume Parsing');
    console.log('=' .repeat(50));
    
    const buffer = Buffer.from(sampleResumeText, 'utf8');
    const result = await parser.processResume(buffer, 'text/plain', 'prince-kumar-resume.txt');
    
    console.log('✅ Parsing completed successfully!\n');
    
    // Display key extracted information
    console.log('👤 Personal Information:');
    console.log(`   Name: ${result.name}`);
    console.log(`   Email: ${result.email}`);
    console.log(`   Phone: ${result.phone}`);
    console.log(`   Location: ${result.location}`);
    console.log(`   LinkedIn: ${result.linkedinUrl}`);
    console.log(`   Portfolio: ${result.portfolioUrl}\n`);
    
    console.log('💼 Work Experience:');
    result.experience.forEach((exp, index) => {
      console.log(`   ${index + 1}. ${exp.title} at ${exp.company}`);
      console.log(`      Duration: ${exp.duration}`);
      console.log(`      Current: ${exp.isCurrentJob ? 'Yes' : 'No'}`);
      console.log(`      Technologies: ${exp.technologies.join(', ')}`);
      console.log(`      Responsibilities: ${exp.responsibilities.length} items`);
      console.log(`      Achievements: ${exp.achievements.length} items\n`);
    });
    
    console.log('🛠️ Technical Skills:');
    if (result.skills && result.skills.technical) {
      if (Array.isArray(result.skills.technical)) {
        result.skills.technical.forEach(skill => {
          console.log(`   • ${skill.name || skill}: ${skill.years || 0} years (${skill.level || 'N/A'})`);
        });
      } else {
        Object.entries(result.skills.technical).forEach(([category, skills]) => {
          console.log(`   ${category}:`);
          skills.forEach(skill => {
            console.log(`     • ${skill.name || skill}: ${skill.years || 0} years (${skill.level || 'N/A'})`);
          });
        });
      }
    }
    console.log();
    
    console.log('🎓 Education:');
    result.education.forEach((edu, index) => {
      console.log(`   ${index + 1}. ${edu.degree} in ${edu.fieldOfStudy}`);
      console.log(`      Institution: ${edu.institution}`);
      console.log(`      Duration: ${edu.startDate} - ${edu.endDate}\n`);
    });
    
    console.log('📊 Additional Information:');
    console.log(`   Total Experience: ${result.additionalInfo?.totalExperience || 'Not calculated'}`);
    console.log(`   Career Level: ${result.additionalInfo?.careerLevel || 'Not determined'}`);
    
    // Test 2: Detailed parsing with metadata
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test 2: Detailed Parsing with Metadata');
    console.log('=' .repeat(50));
    
    const detailedResult = await parser.processResumeDetailed(buffer, 'text/plain', 'prince-kumar-resume.txt');
    
    console.log('📈 Experience Metrics:');
    if (detailedResult.candidate.experienceMetrics) {
      const metrics = detailedResult.candidate.experienceMetrics;
      console.log(`   Total Years: ${metrics.totalYears}`);
      console.log(`   Number of Roles: ${metrics.numberOfRoles}`);
      console.log(`   Average Role Duration: ${metrics.averageRoleDuration}`);
      if (metrics.currentRole) {
        console.log(`   Current Role: ${metrics.currentRole.title} at ${metrics.currentRole.company}`);
      }
    }
    
    console.log('\n🚀 Career Progression:');
    if (detailedResult.candidate.careerProgression) {
      const progression = detailedResult.candidate.careerProgression;
      console.log(`   Trend: ${progression.trend}`);
      console.log(`   Progression Score: ${progression.progressionScore}`);
      console.log(`   Role Changes: ${progression.roleChanges}`);
      console.log(`   Company Changes: ${progression.companyChanges}`);
    }
    
    console.log('\n🏆 Key Achievements:');
    if (detailedResult.candidate.keyAchievements) {
      detailedResult.candidate.keyAchievements.slice(0, 5).forEach((achievement, index) => {
        console.log(`   ${index + 1}. ${achievement.description}`);
        console.log(`      Company: ${achievement.company}`);
        console.log(`      Impact: ${achievement.impact}`);
        if (achievement.metrics.length > 0) {
          console.log(`      Metrics: ${achievement.metrics.map(m => `${m.value} (${m.type})`).join(', ')}`);
        }
        console.log();
      });
    }
    
    console.log('📋 Processing Metadata:');
    console.log(`   Method: ${detailedResult.metadata.processingMethod}`);
    console.log(`   Timestamp: ${detailedResult.metadata.timestamp}`);
    console.log(`   Original Filename: ${detailedResult.metadata.originalFilename}`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Test fallback
    console.log('\n🔄 Testing fallback extraction...');
    try {
      const fallbackResult = await parser.fallbackExtraction(buffer, 'text/plain', 'test-resume.txt');
      console.log('✅ Fallback extraction successful');
      console.log('Basic info extracted:', {
        name: fallbackResult.name,
        email: fallbackResult.email,
        phone: fallbackResult.phone,
        skills: fallbackResult.skills.technical.length
      });
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
    }
  }
}

// Test with actual PDF file if provided
async function testWithPdfFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`📄 PDF file not found at: ${filePath}`);
    return;
  }
  
  console.log(`\n📄 Testing with PDF file: ${filePath}`);
  console.log('=' .repeat(50));
  
  const parser = new NewResumeParserService();
  const buffer = fs.readFileSync(filePath);
  
  try {
    const result = await parser.processResume(buffer, 'application/pdf', path.basename(filePath));
    console.log('✅ PDF parsing successful!');
    console.log(`Name: ${result.name}`);
    console.log(`Email: ${result.email}`);
    console.log(`Experience count: ${result.experience.length}`);
    console.log(`Skills count: ${Array.isArray(result.skills.technical) ? result.skills.technical.length : Object.values(result.skills.technical).flat().length}`);
  } catch (error) {
    console.error('❌ PDF parsing failed:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🔧 LangChain Resume Parser Test Suite');
  console.log('=====================================\n');
  
  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  Warning: OPENAI_API_KEY not found in environment variables');
    console.log('   The parser will fall back to basic text extraction\n');
  } else {
    console.log('✅ OpenAI API key found\n');
  }
  
  await testParser();
  
  // Test with PDF if path is provided as command line argument
  const pdfPath = process.argv[2];
  if (pdfPath) {
    await testWithPdfFile(pdfPath);
  } else {
    console.log('\n💡 Tip: You can test with a PDF file by running:');
    console.log('   node test-langchain-parser.js /path/to/resume.pdf');
  }
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testParser, testWithPdfFile };
