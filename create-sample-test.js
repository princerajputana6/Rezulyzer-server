const mongoose = require('mongoose');
const Test = require('./src/models/Test');
const Question = require('./src/models/Question');
require('dotenv').config();

async function createSampleTest() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if there are any tests
    const testCount = await Test.countDocuments();
    console.log(`Found ${testCount} existing tests`);

    if (testCount === 0) {
      console.log('No tests found. Creating a sample test...');

      // Create sample questions
      const sampleQuestions = [
        {
          question: "What is the primary purpose of JavaScript?",
          type: "multiple_choice",
          options: [
            "To style web pages",
            "To add interactivity to web pages",
            "To structure web content",
            "To manage databases"
          ],
          correctAnswer: 1,
          points: 10,
          difficulty: "easy",
          domain: "Programming",
          explanation: "JavaScript is primarily used to add interactivity and dynamic behavior to web pages."
        },
        {
          question: "Which of the following is NOT a JavaScript data type?",
          type: "multiple_choice",
          options: [
            "String",
            "Boolean",
            "Float",
            "Undefined"
          ],
          correctAnswer: 2,
          points: 10,
          difficulty: "medium",
          domain: "Programming",
          explanation: "JavaScript doesn't have a specific 'Float' data type. Numbers in JavaScript are all of type 'Number'."
        },
        {
          question: "What does 'DOM' stand for in web development?",
          type: "multiple_choice",
          options: [
            "Data Object Model",
            "Document Object Model",
            "Dynamic Object Management",
            "Database Operations Manager"
          ],
          correctAnswer: 1,
          points: 10,
          difficulty: "easy",
          domain: "Web Development",
          explanation: "DOM stands for Document Object Model, which represents the structure of HTML documents."
        },
        {
          question: "Which method is used to add an element to the end of an array in JavaScript?",
          type: "multiple_choice",
          options: [
            "append()",
            "push()",
            "add()",
            "insert()"
          ],
          correctAnswer: 1,
          points: 10,
          difficulty: "easy",
          domain: "Programming",
          explanation: "The push() method adds one or more elements to the end of an array."
        },
        {
          question: "What is the correct way to declare a variable in modern JavaScript?",
          type: "multiple_choice",
          options: [
            "var myVariable;",
            "let myVariable;",
            "const myVariable;",
            "All of the above"
          ],
          correctAnswer: 3,
          points: 10,
          difficulty: "medium",
          domain: "Programming",
          explanation: "All three (var, let, const) are valid ways to declare variables, though let and const are preferred in modern JavaScript."
        }
      ];

      // Create questions
      const createdQuestions = [];
      for (const questionData of sampleQuestions) {
        const question = new Question(questionData);
        await question.save();
        createdQuestions.push(question._id);
        console.log(`Created question: ${questionData.question.substring(0, 50)}...`);
      }

      // Create a sample test
      const sampleTest = new Test({
        title: "JavaScript Fundamentals Assessment",
        description: "A basic assessment covering JavaScript fundamentals and web development concepts.",
        duration: 30, // 30 minutes
        questions: createdQuestions,
        totalQuestions: createdQuestions.length,
        passingScore: 60,
        status: 'published',
        isPublic: true,
        createdBy: new mongoose.Types.ObjectId(), // Dummy creator ID
        settings: {
          shuffleQuestions: true,
          showResults: true,
          allowReview: true,
          timeLimit: 30
        }
      });

      await sampleTest.save();
      console.log(`✅ Created sample test: ${sampleTest.title}`);
      console.log(`   - ${createdQuestions.length} questions`);
      console.log(`   - Duration: ${sampleTest.duration} minutes`);
      console.log(`   - Status: ${sampleTest.status}`);
      console.log(`   - Test ID: ${sampleTest._id}`);

    } else {
      console.log('Tests already exist in the database');
      
      // Show existing tests
      const tests = await Test.find().select('title status createdAt').limit(5);
      console.log('\nExisting tests:');
      tests.forEach(test => {
        console.log(`- ${test.title} (${test.status}) - ${test.createdAt.toDateString()}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createSampleTest().catch(console.error);
}

module.exports = { createSampleTest };
