const mongoose = require('mongoose');
const Candidate = require('./src/models/Candidate');
require('dotenv').config();

async function debugTokenIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if there are any candidates with assessment tokens
    const candidatesWithTokens = await Candidate.find({
      assessmentToken: { $exists: true, $ne: null }
    }).select('name email assessmentToken assessmentTokenExpiry assignedTests');

    console.log(`\n📊 Found ${candidatesWithTokens.length} candidates with assessment tokens:`);
    
    candidatesWithTokens.forEach((candidate, index) => {
      console.log(`\n${index + 1}. ${candidate.name} (${candidate.email})`);
      console.log(`   Token: ${candidate.assessmentToken?.substring(0, 16)}...`);
      console.log(`   Expiry: ${candidate.assessmentTokenExpiry}`);
      console.log(`   Expired: ${candidate.assessmentTokenExpiry < new Date()}`);
      console.log(`   Assigned Tests: ${candidate.assignedTests?.length || 0}`);
      
      if (candidate.assignedTests?.length > 0) {
        candidate.assignedTests.forEach((test, i) => {
          console.log(`     ${i + 1}. Test ID: ${test.testId}, Status: ${test.status}`);
        });
      }
    });

    // Check all candidates to see their current state
    const allCandidates = await Candidate.find({}).select('name email assessmentToken assignedTests').limit(5);
    
    console.log(`\n📋 Recent candidates (showing first 5):`);
    allCandidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.name} - Has Token: ${!!candidate.assessmentToken}, Tests: ${candidate.assignedTests?.length || 0}`);
    });

    // Test token validation logic
    if (candidatesWithTokens.length > 0) {
      const testCandidate = candidatesWithTokens[0];
      console.log(`\n🔍 Testing token validation for: ${testCandidate.name}`);
      
      // Simulate the validation query
      const validationResult = await Candidate.findOne({
        assessmentToken: testCandidate.assessmentToken,
        assessmentTokenExpiry: { $gt: new Date() }
      });

      console.log(`   Validation result: ${validationResult ? 'SUCCESS' : 'FAILED'}`);
      
      if (validationResult) {
        const pendingTests = validationResult.assignedTests.filter(test => test.status === 'pending');
        console.log(`   Pending tests: ${pendingTests.length}`);
        
        if (pendingTests.length > 0) {
          console.log(`   First test: ${pendingTests[0].testId?.title || pendingTests[0].testId}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugTokenIssue().catch(console.error);
