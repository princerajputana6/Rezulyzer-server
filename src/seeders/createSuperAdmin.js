const mongoose = require('mongoose');
const User = require('../models/User');
const { USER_ROLES } = require('../utils/constants');
const logger = require('../utils/logger');
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for seeding');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: USER_ROLES.SUPER_ADMIN });
    
    if (existingSuperAdmin) {
      logger.info('Super admin already exists:', existingSuperAdmin.email);
      return;
    }

    // Create super admin
    const superAdminData = {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@aitestingportal.com',
      password: 'SuperAdmin123!',
      role: USER_ROLES.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true
    };

    const superAdmin = await User.create(superAdminData);
    logger.info('Super admin created successfully:', superAdmin.email);
    
    console.log('\n=== SUPER ADMIN CREDENTIALS ===');
    console.log('Email:', superAdminData.email);
    console.log('Password:', superAdminData.password);
    console.log('================================\n');

  } catch (error) {
    logger.error('Error creating super admin:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
};

// Run if called directly
if (require.main === module) {
  createSuperAdmin();
}

module.exports = createSuperAdmin;
