const axios = require('axios');

// Test the complete assessment invitation flow
async function testAssessmentFlow() {
  const baseURL = 'http://localhost:8000/api';
  
  console.log('🧪 Testing Assessment Invitation Flow\n');
  
  try {
    // Step 1: Get a candidate ID (you'll need to replace this with an actual candidate ID)
    console.log('📋 Step 1: Getting candidates...');
    const candidatesResponse = await axios.get(`${baseURL}/candidates`);
    
    if (!candidatesResponse.data.success || candidatesResponse.data.data.length === 0) {
      console.log('❌ No candidates found. Please create a candidate first.');
      return;
    }
    
    const candidate = candidatesResponse.data.data[0];
    console.log(`✅ Found candidate: ${candidate.name} (${candidate.email})`);
    console.log(`   Candidate ID: ${candidate._id}\n`);
    
    // Step 2: Send assessment invitation
    console.log('📧 Step 2: Sending assessment invitation...');
    const invitationResponse = await axios.post(`${baseURL}/candidates/${candidate._id}/send-assessment`);
    
    if (invitationResponse.data.success) {
      console.log('✅ Assessment invitation sent successfully!');
      console.log(`   Processing time: ${invitationResponse.data.processingTime}`);
      console.log('   Check your server console for the mock email with the assessment URL\n');
    } else {
      console.log('❌ Failed to send invitation:', invitationResponse.data.message);
      return;
    }
    
    // Step 3: Get the updated candidate to see the token
    console.log('🔍 Step 3: Checking candidate for assessment token...');
    const updatedCandidateResponse = await axios.get(`${baseURL}/candidates/${candidate._id}`);
    
    if (updatedCandidateResponse.data.success) {
      const updatedCandidate = updatedCandidateResponse.data.data;
      
      if (updatedCandidate.assessmentToken) {
        console.log('✅ Assessment token generated successfully!');
        console.log(`   Token: ${updatedCandidate.assessmentToken.substring(0, 16)}...`);
        console.log(`   Password: ${updatedCandidate.assessmentPassword}`);
        console.log(`   Expires: ${updatedCandidate.assessmentTokenExpiry}`);
        
        const assessmentURL = `http://localhost:3000/assessment-login?token=${updatedCandidate.assessmentToken}`;
        console.log(`   Assessment URL: ${assessmentURL}\n`);
        
        // Step 4: Test token validation
        console.log('🔐 Step 4: Testing token validation...');
        const validationResponse = await axios.get(`${baseURL}/candidates/assessment/validate/${updatedCandidate.assessmentToken}`);
        
        if (validationResponse.data.success) {
          console.log('✅ Token validation successful!');
          console.log(`   Candidate: ${validationResponse.data.data.name}`);
          console.log(`   Email: ${validationResponse.data.data.email}`);
          console.log(`   Pending tests: ${validationResponse.data.data.pendingTests.length}`);
          console.log(`   Has password: ${validationResponse.data.data.hasAssessmentPassword}\n`);
          
          // Step 5: Test assessment login
          console.log('🔑 Step 5: Testing assessment login...');
          const loginResponse = await axios.post(`${baseURL}/candidates/assessment/login`, {
            token: updatedCandidate.assessmentToken,
            email: updatedCandidate.email,
            password: updatedCandidate.assessmentPassword
          });
          
          if (loginResponse.data.success) {
            console.log('✅ Assessment login successful!');
            console.log(`   Session token: ${loginResponse.data.data.sessionToken.substring(0, 16)}...`);
            console.log(`   Candidate: ${loginResponse.data.data.name}`);
            console.log('\n🎉 Complete assessment flow test PASSED!');
            
            console.log('\n📋 Summary:');
            console.log(`   1. ✅ Candidate found: ${candidate.name}`);
            console.log(`   2. ✅ Invitation sent with unique URL`);
            console.log(`   3. ✅ Assessment token generated`);
            console.log(`   4. ✅ Token validation works`);
            console.log(`   5. ✅ Assessment login works`);
            console.log('\n🔗 The assessment URL now includes a unique token!');
            console.log(`   URL: ${assessmentURL}`);
            
          } else {
            console.log('❌ Assessment login failed:', loginResponse.data.message);
          }
        } else {
          console.log('❌ Token validation failed:', validationResponse.data.message);
        }
      } else {
        console.log('❌ No assessment token found on candidate');
      }
    } else {
      console.log('❌ Failed to get updated candidate:', updatedCandidateResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('   Response data:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testAssessmentFlow().catch(console.error);
}

module.exports = { testAssessmentFlow };
