const axios = require('axios');
const mongoose = require('mongoose');
const Candidate = require('./src/models/Candidate');
require('dotenv').config();

async function testTokenAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔍 Testing Token API Endpoint\n');

    // Get a candidate with a token
    const candidate = await Candidate.findOne({
      assessmentToken: { $exists: true, $ne: null }
    }).select('name email assessmentToken assessmentTokenExpiry');

    if (!candidate) {
      console.log('❌ No candidate with assessment token found');
      return;
    }

    console.log(`✅ Found candidate: ${candidate.name}`);
    console.log(`   Token: ${candidate.assessmentToken.substring(0, 16)}...`);
    console.log(`   Expiry: ${candidate.assessmentTokenExpiry}`);
    console.log(`   Is Expired: ${candidate.assessmentTokenExpiry < new Date()}`);

    // Test the API endpoint
    const baseURL = 'http://localhost:8000/api';
    const token = candidate.assessmentToken;

    console.log(`\n🧪 Testing API endpoint: GET /candidates/assessment/validate/${token.substring(0, 16)}...`);

    try {
      const response = await axios.get(`${baseURL}/candidates/assessment/validate/${token}`);
      
      console.log('✅ API Response Success!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Success: ${response.data.success}`);
      console.log(`   Candidate: ${response.data.data.name}`);
      console.log(`   Pending Tests: ${response.data.data.pendingTests.length}`);
      
      if (response.data.data.pendingTests.length > 0) {
        console.log('\n📋 Pending Tests:');
        response.data.data.pendingTests.forEach((test, index) => {
          console.log(`   ${index + 1}. ${test.testId.title || test.testId}`);
        });
      }

    } catch (error) {
      console.error('❌ API Error:');
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.data?.message}`);
      console.error(`   Full Response:`, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Script Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testTokenAPI().catch(console.error);
