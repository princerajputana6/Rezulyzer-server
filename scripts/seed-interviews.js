require('dotenv').config();
const connectDB = require('../src/config/database');
const mongoose = require('mongoose');
const Interview = require('../src/models/Interview');
const Candidate = require('../src/models/Candidate');
const User = require('../src/models/User');

(async () => {
  try {
    await connectDB();

    // Pick a company by taking first candidate's company or first admin's company
    const candidate = await Candidate.findOne().lean();
    if (!candidate) {
      console.log('No candidates found. Please seed candidates first.');
      process.exit(0);
    }
    const companyId = candidate.companyId;

    const interviewer = await User.findOne({ role: { $in: ['admin', 'company'] }, ...(companyId ? { companyId } : {}) });
    if (!interviewer) {
      console.log('No interviewer user found (admin/company). Please create a user first.');
      process.exit(0);
    }

    const now = new Date();
    const items = [
      {
        title: 'Technical Interview',
        description: 'Node.js & System design',
        candidateId: candidate._id,
        companyId,
        interviewerId: interviewer._id,
        scheduledDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // +1 day
        duration: 60,
        type: 'technical',
        mode: 'online',
        meetingLink: 'https://meet.example.com/abc',
        priority: 'medium',
        createdBy: interviewer._id
      },
      {
        title: 'Behavioral Round',
        description: 'Team fit and communication',
        candidateId: candidate._id,
        companyId,
        interviewerId: interviewer._id,
        scheduledDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // +2 days
        duration: 45,
        type: 'behavioral',
        mode: 'video',
        meetingLink: 'https://meet.example.com/xyz',
        priority: 'low',
        createdBy: interviewer._id
      },
      {
        title: 'Final Round',
        description: 'Decision meeting with leadership',
        candidateId: candidate._id,
        companyId,
        interviewerId: interviewer._id,
        scheduledDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // +5 days
        duration: 30,
        type: 'final',
        mode: 'onsite',
        location: 'HQ - Conf Room A',
        priority: 'high',
        createdBy: interviewer._id
      }
    ];

    const created = await Interview.insertMany(items);
    console.log(`Seeded ${created.length} interviews.`);
  } catch (err) {
    console.error('Error seeding interviews:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
})();
