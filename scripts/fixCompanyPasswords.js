const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import Company model
const Company = require('../src/models/Company');

// Generate system password function (same as in controller)
const generateSystemPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special
  
  // Fill remaining length
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const fixCompanyPasswords = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find all companies that need password reset
    const companies = await Company.find({ 
      passwordResetRequired: true 
    }).select('+password');

    console.log(`Found ${companies.length} companies that need password reset`);

    const updatedCompanies = [];

    for (const company of companies) {
      try {
        // Generate new password
        const newPassword = generateSystemPassword();
        
        // Set the password directly (let pre-save middleware handle hashing)
        company.password = newPassword;
        await company.save();

        updatedCompanies.push({
          companyName: company.companyName,
          email: company.email,
          newPassword: newPassword
        });

        console.log(`✓ Updated password for: ${company.companyName} (${company.email})`);
      } catch (error) {
        console.error(`✗ Failed to update password for ${company.companyName}:`, error.message);
      }
    }

    console.log('\n=== PASSWORD RESET SUMMARY ===');
    console.log(`Total companies processed: ${companies.length}`);
    console.log(`Successfully updated: ${updatedCompanies.length}`);
    
    if (updatedCompanies.length > 0) {
      console.log('\n=== NEW CREDENTIALS ===');
      updatedCompanies.forEach(company => {
        console.log(`Company: ${company.companyName}`);
        console.log(`Email: ${company.email}`);
        console.log(`New Password: ${company.newPassword}`);
        console.log('---');
      });
    }

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    
  } catch (error) {
    console.error('Error fixing company passwords:', error);
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  fixCompanyPasswords();
}

module.exports = { fixCompanyPasswords };
