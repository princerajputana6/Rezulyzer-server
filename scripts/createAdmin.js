const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-test');
    console.log('Connected to MongoDB');

    // Find user by email (replace with your email)
    const email = process.argv[2];
    if (!email) {
      console.log('Usage: node createAdmin.js <email>');
      process.exit(1);
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User with email ${email} not found`);
      process.exit(1);
    }

    // Update user role to admin
    user.role = 'admin';
    await user.save();

    console.log(`User ${email} has been promoted to admin`);
    console.log(`User details:`, {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createAdmin();
