const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Company = require('../src/models/Company');
const Question = require('../src/models/Question');
const Test = require('../src/models/Test');
const Candidate = require('../src/models/Candidate');
const SystemSettings = require('../src/models/SystemSettings');
const Billing = require('../src/models/Billing');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-test-portal');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const createSuperAdmin = async () => {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ 
      email: 'superadmin@aitest.com',
      role: 'super_admin' 
    });

    if (existingSuperAdmin) {
      console.log('⚠️  Super Admin already exists');
      return existingSuperAdmin;
    }

    // Create default Super Admin
    const superAdmin = new User({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@aitest.com',
      password: 'SuperAdmin@2024!',
      role: 'super_admin',
      isActive: true,
      isEmailVerified: true,
      preferences: {
        theme: 'light',
        notifications: {
          email: true,
          testInvitations: true,
          testResults: true,
        },
        language: 'en',
      },
      profile: {
        bio: 'System Administrator for AI Test Portal',
        location: 'Global',
      },
    });

    await superAdmin.save();
    console.log('✅ Super Admin created successfully');
    console.log('📧 Email: superadmin@aitest.com');
    console.log('🔑 Password: SuperAdmin@2024!');
    
    return superAdmin;
  } catch (error) {
    console.error('❌ Error creating Super Admin:', error.message);
    throw error;
  }
};

const createSampleCompanies = async (superAdminId) => {
  try {
    const companies = [
      {
        companyName: 'TechCorp Solutions',
        email: 'admin@techcorp.com',
        password: 'TechCorp@2024!',
        industry: 'Technology',
        size: '201-500',
        address: {
          street: '123 Tech Street',
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
          zipCode: '94105',
        },
        contactPerson: {
          name: 'John Smith',
          email: 'john.smith@techcorp.com',
          phone: '+1-555-0123',
          designation: 'HR Manager',
        },
        subscriptionPlan: 'premium',
        subscriptionStatus: 'active',
        creditsRemaining: 500,
        createdBy: superAdminId,
        status: 'active',
        isEmailVerified: true,
      },
      {
        companyName: 'StartupHub Inc',
        email: 'admin@startuphub.com',
        password: 'StartupHub@2024!',
        industry: 'Technology',
        size: '11-50',
        address: {
          street: '456 Innovation Ave',
          city: 'Austin',
          state: 'TX',
          country: 'USA',
          zipCode: '73301',
        },
        contactPerson: {
          name: 'Sarah Johnson',
          email: 'sarah.johnson@startuphub.com',
          phone: '+1-555-0456',
          designation: 'CTO',
        },
        subscriptionPlan: 'standard',
        subscriptionStatus: 'active',
        creditsRemaining: 200,
        createdBy: superAdminId,
        status: 'active',
        isEmailVerified: true,
      },
      {
        companyName: 'FinanceFirst Bank',
        email: 'admin@financefirst.com',
        password: 'FinanceFirst@2024!',
        industry: 'Finance',
        size: '1000+',
        address: {
          street: '789 Wall Street',
          city: 'New York',
          state: 'NY',
          country: 'USA',
          zipCode: '10005',
        },
        contactPerson: {
          name: 'Michael Brown',
          email: 'michael.brown@financefirst.com',
          phone: '+1-555-0789',
          designation: 'Head of Talent Acquisition',
        },
        subscriptionPlan: 'enterprise',
        subscriptionStatus: 'active',
        creditsRemaining: 1000,
        createdBy: superAdminId,
        status: 'active',
        isEmailVerified: true,
      },
    ];

    const createdCompanies = [];
    for (const companyData of companies) {
      const existingCompany = await Company.findOne({ email: companyData.email });
      if (!existingCompany) {
        const company = new Company(companyData);
        await company.save();
        createdCompanies.push(company);
        console.log(`✅ Company created: ${company.companyName}`);
      } else {
        createdCompanies.push(existingCompany);
        console.log(`⚠️  Company already exists: ${existingCompany.companyName}`);
      }
    }

    return createdCompanies;
  } catch (error) {
    console.error('❌ Error creating sample companies:', error.message);
    throw error;
  }
};

const createSampleQuestions = async (superAdminId) => {
  try {
    const questions = [
      {
        question: 'What is the time complexity of binary search?',
        type: 'multiple-choice',
        domain: 'Algorithms',
        subDomain: 'Search Algorithms',
        difficulty: 'medium',
        points: 10,
        options: [
          { text: 'O(n)', isCorrect: false },
          { text: 'O(log n)', isCorrect: true },
          { text: 'O(n log n)', isCorrect: false },
          { text: 'O(n²)', isCorrect: false },
        ],
        correctAnswer: 'O(log n)',
        explanation: 'Binary search divides the search space in half with each comparison, resulting in O(log n) time complexity.',
        tags: ['algorithms', 'complexity', 'search'],
        createdBy: superAdminId,
        isPublic: true,
        isActive: true,
      },
      {
        question: 'Write a function to reverse a string in JavaScript.',
        type: 'coding',
        domain: 'JavaScript',
        subDomain: 'String Manipulation',
        difficulty: 'easy',
        points: 15,
        codeTemplate: `function reverseString(str) {
  // Your code here
  
}`,
        testCases: [
          {
            input: 'hello',
            expectedOutput: 'olleh',
            isHidden: false,
            description: 'Basic string reversal',
          },
          {
            input: 'JavaScript',
            expectedOutput: 'tpircSavaJ',
            isHidden: false,
            description: 'Mixed case string',
          },
          {
            input: '',
            expectedOutput: '',
            isHidden: true,
            description: 'Empty string edge case',
          },
        ],
        explanation: 'You can reverse a string using various methods like split().reverse().join() or a for loop.',
        tags: ['javascript', 'strings', 'coding'],
        createdBy: superAdminId,
        isPublic: true,
        isActive: true,
      },
      {
        question: 'What is the difference between SQL and NoSQL databases?',
        type: 'essay',
        domain: 'SQL',
        subDomain: 'Database Concepts',
        difficulty: 'medium',
        points: 20,
        explanation: 'SQL databases are relational with fixed schemas, while NoSQL databases are non-relational with flexible schemas.',
        tags: ['databases', 'sql', 'nosql'],
        createdBy: superAdminId,
        isPublic: true,
        isActive: true,
      },
      {
        question: 'React components can only return a single element.',
        type: 'true-false',
        domain: 'React',
        subDomain: 'Component Structure',
        difficulty: 'easy',
        points: 5,
        correctAnswer: false,
        explanation: 'React components can return multiple elements using React.Fragment or an array.',
        tags: ['react', 'components', 'jsx'],
        createdBy: superAdminId,
        isPublic: true,
        isActive: true,
      },
      {
        question: 'Implement a function to find the maximum element in an array using Python.',
        type: 'coding',
        domain: 'Python',
        subDomain: 'Array Operations',
        difficulty: 'easy',
        points: 10,
        codeTemplate: `def find_max(arr):
    # Your code here
    pass`,
        testCases: [
          {
            input: [1, 5, 3, 9, 2],
            expectedOutput: 9,
            isHidden: false,
            description: 'Array with positive numbers',
          },
          {
            input: [-1, -5, -3, -2],
            expectedOutput: -1,
            isHidden: false,
            description: 'Array with negative numbers',
          },
          {
            input: [42],
            expectedOutput: 42,
            isHidden: true,
            description: 'Single element array',
          },
        ],
        explanation: 'You can use the built-in max() function or iterate through the array.',
        tags: ['python', 'arrays', 'algorithms'],
        createdBy: superAdminId,
        isPublic: true,
        isActive: true,
      },
    ];

    const createdQuestions = [];
    for (const questionData of questions) {
      const existingQuestion = await Question.findOne({ 
        question: questionData.question,
        createdBy: superAdminId 
      });
      
      if (!existingQuestion) {
        const question = new Question(questionData);
        await question.save();
        createdQuestions.push(question);
        console.log(`✅ Question created: ${question.domain} - ${question.difficulty}`);
      } else {
        createdQuestions.push(existingQuestion);
        console.log(`⚠️  Question already exists: ${existingQuestion.domain}`);
      }
    }

    return createdQuestions;
  } catch (error) {
    console.error('❌ Error creating sample questions:', error.message);
    throw error;
  }
};

const createSampleTests = async (superAdminId, companyIds) => {
  try {
    const sampleTests = [
      {
        title: 'JavaScript Fundamentals Assessment',
        description: 'Comprehensive test covering JavaScript basics, ES6 features, and DOM manipulation',
        type: 'technical',
        duration: 60,
        totalQuestions: 15,
        passingScore: 70,
        difficulty: 'medium',
        status: 'published',
        createdBy: superAdminId,
        companyId: companyIds[0],
        settings: {
          shuffleQuestions: true,
          showResults: true,
          allowReview: true,
          timeLimit: 60,
          attemptsAllowed: 1,
          proctoring: {
            enabled: false,
            strictMode: false,
            allowCopyPaste: false,
            detectTabSwitch: true,
            requireWebcam: false,
          },
        },
        instructions: 'Read each question carefully and select the best answer. You have 60 minutes to complete this test.',
        tags: ['javascript', 'frontend', 'programming'],
      },
      {
        title: 'Python Programming Assessment',
        description: 'Basic Python knowledge assessment',
        type: 'technical',
        difficulty: 'easy',
        duration: 45,
        totalQuestions: 2,
        passingScore: 60,
        status: 'published',
        createdBy: superAdminId,
        tags: ['python', 'fundamentals'],
      },
      {
        title: 'Algorithm & Data Structures',
        description: 'Test algorithmic thinking and data structure knowledge',
        type: 'technical',
        difficulty: 'hard',
        duration: 120,
        totalQuestions: 1,
        passingScore: 80,
        createdBy: superAdminId,
        tags: ['algorithms', 'data-structures', 'computer-science'],
        status: 'published',
      },
    ];

    const createdTests = [];
    for (const testData of sampleTests) {
      const existingTest = await Test.findOne({ 
        title: testData.title,
        createdBy: superAdminId 
      });
      
      if (!existingTest) {
        const test = new Test(testData);
        await test.save();
        createdTests.push(test);
        console.log(`✅ Test created: ${test.title}`);
      } else {
        createdTests.push(existingTest);
        console.log(`⚠️  Test already exists: ${existingTest.title}`);
      }
    }

    return createdTests;
  } catch (error) {
    console.error('❌ Error creating sample tests:', error.message);
    throw error;
  }
};

const createSampleCandidates = async (companies) => {
  try {
    const candidates = [
      {
        name: 'Alice Johnson',
        email: 'alice.johnson@email.com',
        phone: '+1-555-1001',
        companyId: companies[0]._id,
        profile: {
          skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
          experience: '3 years',
          education: 'Bachelor in Computer Science',
          position: 'Frontend Developer',
          department: 'Engineering',
          location: 'San Francisco, CA',
        },
        status: 'active',
        tags: ['frontend', 'react', 'javascript'],
      },
      {
        name: 'Bob Smith',
        email: 'bob.smith@email.com',
        phone: '+1-555-1002',
        companyId: companies[0]._id,
        profile: {
          skills: ['Python', 'Django', 'PostgreSQL', 'AWS'],
          experience: '5 years',
          education: 'Master in Software Engineering',
          position: 'Backend Developer',
          department: 'Engineering',
          location: 'San Francisco, CA',
        },
        status: 'active',
        tags: ['backend', 'python', 'django'],
      },
      {
        name: 'Carol Davis',
        email: 'carol.davis@email.com',
        phone: '+1-555-1003',
        companyId: companies[1]._id,
        profile: {
          skills: ['Java', 'Spring Boot', 'MySQL', 'Docker'],
          experience: '4 years',
          education: 'Bachelor in Information Technology',
          position: 'Full Stack Developer',
          department: 'Product',
          location: 'Austin, TX',
        },
        status: 'active',
        tags: ['fullstack', 'java', 'spring'],
      },
    ];

    const createdCandidates = [];
    for (const candidateData of candidates) {
      const existingCandidate = await Candidate.findOne({ email: candidateData.email });
      if (!existingCandidate) {
        const candidate = new Candidate(candidateData);
        await candidate.save();
        createdCandidates.push(candidate);
        console.log(`✅ Candidate created: ${candidate.name}`);
      } else {
        createdCandidates.push(existingCandidate);
        console.log(`⚠️  Candidate already exists: ${existingCandidate.name}`);
      }
    }

    return createdCandidates;
  } catch (error) {
    console.error('❌ Error creating sample candidates:', error.message);
    throw error;
  }
};

const initializeSystemSettings = async (superAdminId) => {
  try {
    await SystemSettings.initializeDefaults(superAdminId);
    console.log('✅ System settings initialized');
  } catch (error) {
    console.error('❌ Error initializing system settings:', error.message);
    throw error;
  }
};

const createSampleBilling = async (companies) => {
  try {
    const billingRecords = [
      {
        companyId: companies[0]._id,
        amount: 299.99,
        planName: 'premium',
        billingPeriod: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        dueDate: new Date('2024-01-15'),
        status: 'paid',
        paidDate: new Date('2024-01-10'),
        transactionId: 'txn_premium_001',
        items: [
          {
            description: 'Premium Plan - Monthly',
            quantity: 1,
            unitPrice: 299.99,
            totalPrice: 299.99,
          },
        ],
      },
      {
        companyId: companies[1]._id,
        amount: 99.99,
        planName: 'standard',
        billingPeriod: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        dueDate: new Date('2024-01-15'),
        status: 'paid',
        paidDate: new Date('2024-01-12'),
        transactionId: 'txn_standard_001',
        items: [
          {
            description: 'Standard Plan - Monthly',
            quantity: 1,
            unitPrice: 99.99,
            totalPrice: 99.99,
          },
        ],
      },
    ];

    const createdBilling = [];
    for (const billingData of billingRecords) {
      const existingBilling = await Billing.findOne({ 
        companyId: billingData.companyId,
        'billingPeriod.startDate': billingData.billingPeriod.startDate 
      });
      
      if (!existingBilling) {
        const billing = new Billing(billingData);
        await billing.save();
        createdBilling.push(billing);
        console.log(`✅ Billing record created for company: ${billing.companyId}`);
      } else {
        createdBilling.push(existingBilling);
        console.log(`⚠️  Billing record already exists for company: ${existingBilling.companyId}`);
      }
    }

    return createdBilling;
  } catch (error) {
    console.error('❌ Error creating sample billing records:', error.message);
    throw error;
  }
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    await connectDB();

    // Create super admin
    const superAdmin = await createSuperAdmin();
    console.log('');

    // Create sample companies
    const companies = await createSampleCompanies(superAdmin._id);
    console.log('');

    // Create sample questions
    const questions = await createSampleQuestions(superAdmin._id);
    console.log('');

    // Create sample tests
    const tests = await createSampleTests(superAdmin._id, questions, companies);
    console.log('');

    // Create sample candidates
    const candidates = await createSampleCandidates(companies);
    console.log('');

    // Initialize system settings
    await initializeSystemSettings(superAdmin._id);
    console.log('');

    // Create sample billing records
    await createSampleBilling(companies);
    console.log('');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   👤 Super Admin: 1`);
    console.log(`   🏢 Companies: ${companies.length}`);
    console.log(`   ❓ Questions: ${questions.length}`);
    console.log(`   📝 Tests: ${tests.length}`);
    console.log(`   👥 Candidates: ${candidates.length}`);
    console.log(`   💳 Billing Records: 2`);
    console.log(`   ⚙️  System Settings: Initialized`);

    console.log('\n🔐 Login Credentials:');
    console.log('   Super Admin:');
    console.log('   📧 Email: superadmin@aitest.com');
    console.log('   🔑 Password: SuperAdmin@2024!');
    console.log('\n   Sample Companies:');
    console.log('   📧 TechCorp: admin@techcorp.com / TechCorp@2024!');
    console.log('   📧 StartupHub: admin@startuphub.com / StartupHub@2024!');
    console.log('   📧 FinanceFirst: admin@financefirst.com / FinanceFirst@2024!');

  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
