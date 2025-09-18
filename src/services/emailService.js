const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Create transporter
const createTransporter = () => {
  // Prefer real SMTP when configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Fallback: Ethereal (dev preview) if no SMTP configured
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'ethereal.user@ethereal.email',
      pass: 'ethereal.pass'
    }
  });
};

// Email templates
const getEmailTemplate = (templateName, data) => {
  switch (templateName) {
    case 'candidate-assessment':
      return {
        subject: `Invitation to Take Your Assessment - ${data.companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>AI Test Portal Assessment Invitation</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .credentials { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Assessment Invitation</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.candidateName},</h2>
                <p>You have been invited by <strong>${data.companyName}</strong> to take an online assessment on the AI Test Portal.</p>
                
                <p>Please use the following credentials to log in and begin your test:</p>
                
                <div class="credentials">
                  <h3>Your Login Information</h3>
                  <p><strong>Username:</strong> ${data.email}</p>
                  <p><strong>Password:</strong> ${data.password}</p>
                  <p><strong>Assessment URL:</strong> <a href="${data.loginUrl}">${data.loginUrl}</a></p>
                </div>
                
                <p>Please complete the assessment by the specified due date if one has been provided. We recommend using a stable internet connection in a quiet environment.</p>
                
                <div style="text-align: center;">
                  <a href="${data.loginUrl}" class="button">Begin Assessment</a>
                </div>
                
                <p>Good luck!</p>
                <p>Best regards,<br>The AI Test Portal Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
                <p>&copy; 2024 AI Test Portal. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${data.candidateName},

You have been invited by ${data.companyName} to take an online assessment.

Your Login Information:
Username: ${data.email}
Password: ${data.password}
Assessment URL: ${data.loginUrl}

Please complete the assessment at your earliest convenience.

Good luck!
AI Test Portal Team
        `
      };

    case 'company-credentials':
      return {
        subject: 'Welcome to AI Test Portal - Your Login Credentials',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to AI Test Portal</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .credentials { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to AI Test Portal</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.contactPerson},</h2>
                <p>Your company <strong>${data.companyName}</strong> has been successfully registered on AI Test Portal!</p>
                
                <p>Below are your login credentials:</p>
                
                <div class="credentials">
                  <h3>Login Information</h3>
                  <p><strong>Email:</strong> ${data.email}</p>
                  <p><strong>Temporary Password:</strong> ${data.password}</p>
                  <p><strong>Login URL:</strong> <a href="${data.loginUrl}">${data.loginUrl}</a></p>
                </div>
                
                <p><strong>Important Security Notice:</strong></p>
                <ul>
                  <li>This is a temporary password for first-time login</li>
                  <li>You will be required to reset your password upon first login</li>
                  <li>After password reset, you'll need to login again with your new password</li>
                  <li>Keep your credentials secure and do not share them</li>
                </ul>
                
                <div style="text-align: center;">
                  <a href="${data.loginUrl}" class="button">Login Now</a>
                </div>
                
                <p>If you have any questions or need assistance, please contact our support team.</p>
                
                <p>Best regards,<br>AI Test Portal Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; 2024 AI Test Portal. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Welcome to AI Test Portal!

Hello ${data.contactPerson},

Your company ${data.companyName} has been successfully registered on AI Test Portal!

Login Information:
Email: ${data.email}
Temporary Password: ${data.password}
Login URL: ${data.loginUrl}

Important Security Notice:
- This is a temporary password for first-time login
- You will be required to reset your password upon first login
- After password reset, you'll need to login again with your new password
- Keep your credentials secure and do not share them

If you have any questions or need assistance, please contact our support team.

Best regards,
AI Test Portal Team
        `
      };
    
    default:
      throw new Error(`Email template '${templateName}' not found`);
  }
};

// Send email function
const sendEmail = async ({ to, subject, template, data, html, text }) => {
  try {
    const transporter = createTransporter();

    let emailContent = {};

    if (template && data) {
      emailContent = getEmailTemplate(template, data);
    } else {
      emailContent = { subject, html, text };
    }

    // Always log in development for traceability, but do not short-circuit if SMTP is configured
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=== EMAIL (DEV LOG) ===');
      console.log('To:', to);
      console.log('Subject:', emailContent.subject);
      console.log('Template Data:', data || 'No template data');
      console.log('========================\n');
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@aitestportal.com',
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    };

    try {
      await transporter.verify();
    } catch (verr) {
      console.error('SMTP verification failed:', verr);
      // proceed to attempt send anyway to capture full error from provider
    }

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);

    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Send welcome email
const sendWelcomeEmail = async (userEmail, userName) => {
  return sendEmail({
    to: userEmail,
    subject: 'Welcome to AI Test Portal',
    html: `
      <h1>Welcome ${userName}!</h1>
      <p>Thank you for joining AI Test Portal. We're excited to have you on board!</p>
    `,
    text: `Welcome ${userName}! Thank you for joining AI Test Portal.`
  });
};

// Send password reset email
const sendPasswordResetEmail = async (userEmail, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: userEmail,
    subject: 'Password Reset Request',
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
    `,
    text: `Password reset requested. Visit: ${resetUrl}`
  });
};

// Send company credentials email
const sendCompanyCredentials = async (userEmail, data) => {
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  
  return sendEmail({
    to: userEmail,
    template: 'company-credentials',
    data: {
      ...data,
      loginUrl
    }
  });
};

const sendAssessmentEmail = async (candidateEmail, data) => {
  const base = process.env.CLIENT_URL || 'http://localhost:3000';
  const fallbackLogin = `${base.replace(/\/$/, '')}/assessment-login`;
  const loginUrl = data?.loginUrl || fallbackLogin;

  return sendEmail({
    to: candidateEmail,
    template: 'candidate-assessment',
    data: {
      ...data,
      loginUrl
    }
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendCompanyCredentials,
  sendAssessmentEmail
};
