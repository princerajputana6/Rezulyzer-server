const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { generateTokens } = require('../middleware/auth');
const { sendEmail } = require('../config/email');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  HTTP_STATUS, 
  MESSAGES, 
  EMAIL_SUBJECTS 
} = require('../utils/constants');
const { 
  createSuccessResponse, 
  createErrorResponse 
} = require('../utils/helpers');
const logger = require('../utils/logger');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, userType, companyName, companyStrength } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse(MESSAGES.ERROR.USER_EXISTS)
    );
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: 'user',
    userType,
    companyName,
    companyStrength
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Save refresh token to user
  user.refreshToken = refreshToken;
  await user.save();

  // Log audit
  await AuditLog.create({
    userId: user._id,
    action: 'user_registered',
    details: { email },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send welcome email
  try {
    await sendEmail({
      to: user.email,
      subject: EMAIL_SUBJECTS.WELCOME,
      template: 'welcome',
      data: {
        firstName: user.firstName,
        email: user.email
      }
    });
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
  }

  logger.info(`User registered: ${user.email}`);

  res.status(HTTP_STATUS.CREATED).json(
    createSuccessResponse(MESSAGES.SUCCESS.USER_REGISTERED, {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      },
      accessToken,
      refreshToken
    })
  );
});

// @desc    Login user (supports both User and Company login)
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Try to find user first
  let user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
  let isCompany = false;

  // If no user found, try to find company
  if (!user) {
    const Company = require('../models/Company');
    user = await Company.findOne({ email }).select('+password +isFirstLogin +passwordResetRequired');
    isCompany = true;
  }

  if (!user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      createErrorResponse(MESSAGES.ERROR.INVALID_CREDENTIALS)
    );
  }

  // Check if account is locked (only for regular users)
  if (!isCompany && user.isLocked) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      createErrorResponse(MESSAGES.ERROR.ACCOUNT_LOCKED)
    );
  }

  // Debug password check
  console.log('Login attempt for:', email);
  console.log('Is company:', isCompany);
  console.log('User found:', !!user);
  console.log('Password from request:', password);
  
  // Check password
  const isPasswordValid = await user.matchPassword(password);
  console.log('Password valid:', isPasswordValid);

  if (!isPasswordValid) {
    console.log('Password validation failed');
    // Increment login attempts (only for regular users)
    if (!isCompany && user.incLoginAttempts) {
      await user.incLoginAttempts();
    }
    
    await AuditLog.create({
      userId: user._id,
      action: 'login_failed',
      details: { email, reason: 'invalid_password', userType: isCompany ? 'company' : 'user' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      createErrorResponse(MESSAGES.ERROR.INVALID_CREDENTIALS)
    );
  }

  // Reset login attempts on successful login (only for regular users)
  if (!isCompany && user.loginAttempts > 0) {
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Save refresh token and update login info
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  
  // For companies, check if it's first login
  if (isCompany && user.isFirstLogin) {
    user.isFirstLogin = false;
    await user.save();
  } else {
    await user.save();
  }

  // Log successful login
  await AuditLog.create({
    userId: user._id,
    action: isCompany ? 'company_login' : 'user_login',
    details: { email, userType: isCompany ? 'company' : 'user' },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`${isCompany ? 'Company' : 'User'} logged in: ${user.email}`);

  // Prepare response data
  const responseData = {
    user: {
      id: user._id,
      firstName: isCompany ? user.contactPerson?.name : user.firstName,
      lastName: isCompany ? '' : user.lastName,
      email: user.email,
      role: isCompany ? 'company' : user.role,
      isEmailVerified: isCompany ? true : user.isEmailVerified,
      avatar: user.avatar || null,
      companyName: isCompany ? user.companyName : null,
      userType: isCompany ? 'company' : 'user'
    },
    accessToken,
    refreshToken
  };

  // Add password reset requirement for companies
  if (isCompany && user.passwordResetRequired) {
    responseData.passwordResetRequired = true;
    responseData.message = 'Password reset required for first-time login';
  }

  res.json(
    createSuccessResponse(MESSAGES.SUCCESS.LOGIN_SUCCESS, responseData)
  );
});

// @desc    Reset company password (first-time login)
// @route   POST /api/auth/reset-company-password
// @access  Private (Company only)
const resetCompanyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Find company
  const Company = require('../models/Company');
  const company = await Company.findById(userId).select('+password +passwordResetRequired');

  if (!company) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('Company not found')
    );
  }

  // Verify current password
  const isCurrentPasswordValid = await company.matchPassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('Current password is incorrect')
    );
  }

  // Validate new password
  if (newPassword.length < 8) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('New password must be at least 8 characters long')
    );
  }

  // Update company password (let pre-save middleware handle hashing)
  company.password = newPassword;
  company.passwordResetRequired = false;
  company.lastPasswordReset = new Date();
  await company.save();

  // Log password reset
  await AuditLog.create({
    userId: company._id,
    action: 'password_reset',
    details: { email: company.email, userType: 'company' },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`Company password reset: ${company.email}`);

  res.json(
    createSuccessResponse('Password reset successfully. Please login with your new password.')
  );
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (user) {
    user.refreshToken = null;
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'user_logout',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  res.json(createSuccessResponse(MESSAGES.SUCCESS.LOGOUT_SUCCESS));
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  res.json(
    createSuccessResponse('User profile retrieved', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    })
  );
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      createErrorResponse('Refresh token is required')
    );
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        createErrorResponse('Invalid token type')
      );
    }

    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        createErrorResponse('Invalid refresh token')
      );
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);
    
    // Update refresh token in database
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json(
      createSuccessResponse('Token refreshed successfully', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role
        }
      })
    );
  } catch (error) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      createErrorResponse('Invalid refresh token')
    );
  }
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists or not
    return res.json(
      createSuccessResponse('If the email exists, a reset link has been sent')
    );
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = resetTokenHash;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  // Send reset email
  try {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: user.email,
      subject: EMAIL_SUBJECTS.PASSWORD_RESET,
      template: 'passwordReset',
      data: {
        firstName: user.firstName,
        resetUrl,
        expiresIn: '10 minutes'
      }
    });

    await AuditLog.create({
      userId: user._id,
      action: 'password_reset_requested',
      details: { email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.info(`Password reset requested for: ${user.email}`);
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.error('Failed to send password reset email:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      createErrorResponse('Failed to send reset email')
    );
  }

  res.json(
    createSuccessResponse('If the email exists, a reset link has been sent')
  );
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Hash the token to compare with stored hash
  const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: resetTokenHash,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('Invalid or expired reset token')
    );
  }

  // Set new password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = null; // Invalidate all sessions
  await user.save();

  await AuditLog.create({
    userId: user._id,
    action: 'password_reset_completed',
    details: { email: user.email },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`Password reset completed for: ${user.email}`);

  res.json(createSuccessResponse('Password reset successfully'));
});

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isCurrentPasswordValid = await user.matchPassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('Current password is incorrect')
    );
  }

  // Set new password
  user.password = newPassword;
  user.refreshToken = null; // Invalidate all sessions
  await user.save();

  await AuditLog.create({
    userId: user._id,
    action: 'password_changed',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`Password changed for user: ${user.email}`);

  res.json(createSuccessResponse('Password changed successfully'));
});

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const user = await User.findOne({
    emailVerificationToken: token
  });

  if (!user) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('Invalid verification token')
    );
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();

  await AuditLog.create({
    userId: user._id,
    action: 'email_verified',
    details: { email: user.email },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`Email verified for user: ${user.email}`);

  res.json(createSuccessResponse('Email verified successfully'));
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (user.isEmailVerified) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('Email is already verified')
    );
  }

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = verificationToken;
  await user.save();

  try {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    
    await sendEmail({
      to: user.email,
      subject: EMAIL_SUBJECTS.EMAIL_VERIFICATION,
      template: 'emailVerification',
      data: {
        firstName: user.firstName,
        verificationUrl
      }
    });

    logger.info(`Verification email resent to: ${user.email}`);
  } catch (error) {
    logger.error('Failed to resend verification email:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      createErrorResponse('Failed to send verification email')
    );
  }

  res.json(createSuccessResponse('Verification email sent'));
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
  resetCompanyPassword
};
