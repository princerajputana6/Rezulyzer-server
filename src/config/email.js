const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Send email function
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const message = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html,
    };

    const info = await transporter.sendMail(message);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Error sending email: ${error.message}`);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  welcome: (name) => ({
    subject: 'Welcome to AI Testing Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Welcome to AI Testing Portal!</h2>
        <p>Hi ${name},</p>
        <p>Welcome to our AI-powered testing platform. You can now create, take, and manage tests with the power of artificial intelligence.</p>
        <p>Get started by logging into your account and exploring the features.</p>
        <p>Best regards,<br>AI Testing Portal Team</p>
      </div>
    `,
  }),

  passwordReset: (name, resetUrl) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>You requested a password reset for your AI Testing Portal account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>AI Testing Portal Team</p>
      </div>
    `,
  }),

  testInvitation: (name, testTitle, testUrl) => ({
    subject: `You're invited to take: ${testTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Test Invitation</h2>
        <p>Hi ${name},</p>
        <p>You have been invited to take the following test:</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1e293b;">${testTitle}</h3>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${testUrl}" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Take Test</a>
        </div>
        <p>Good luck!</p>
        <p>Best regards,<br>AI Testing Portal Team</p>
      </div>
    `,
  }),

  testResults: (name, testTitle, score, percentage) => ({
    subject: `Test Results: ${testTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Test Results</h2>
        <p>Hi ${name},</p>
        <p>Your test results for "${testTitle}" are ready:</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #1e293b;">Score: ${score}</h3>
          <p style="margin: 0; font-size: 18px; color: ${percentage >= 70 ? '#22c55e' : '#ef4444'};">
            Percentage: ${percentage}%
          </p>
        </div>
        <p>Thank you for taking the test!</p>
        <p>Best regards,<br>AI Testing Portal Team</p>
      </div>
    `,
  }),
};

module.exports = {
  sendEmail,
  emailTemplates,
};
