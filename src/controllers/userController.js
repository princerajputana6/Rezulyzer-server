const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const TestAttempt = require('../models/TestAttempt');
const { asyncHandler } = require('../middleware/errorHandler');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');
const { createSuccessResponse, createErrorResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    role,
    search,
    isActive
  } = req.query;

  const query = {};

  // Filter by role
  if (role) {
    query.role = role;
  }

  // Filter by active status
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  // Search functionality
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    select: '-password -refreshToken -passwordResetToken -emailVerificationToken'
  };

  const users = await User.paginate(query, options);

  res.json(
    createSuccessResponse('Users retrieved successfully', {
      users: users.docs,
      pagination: getPaginationMeta(users)
    })
  );
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -refreshToken -passwordResetToken -emailVerificationToken');

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('User not found')
    );
  }

  // Users can only view their own profile unless they're admin
  if (req.user.role !== 'super_admin' && 
      req.user.role !== 'admin' && 
      req.user.id !== req.params.id) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      createErrorResponse('Access denied')
    );
  }

  res.json(
    createSuccessResponse('User retrieved successfully', { user })
  );
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('User not found')
    );
  }

  // Check if email is already taken by another user
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        createErrorResponse('Email is already in use')
      );
    }
    user.isEmailVerified = false; // Reset email verification if email changed
  }

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (email) user.email = email;

  await user.save();

  await AuditLog.create({
    userId: req.user.id,
    action: 'profile_updated',
    details: { updatedFields: Object.keys(req.body) },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`Profile updated for user: ${user.email}`);

  res.json(
    createSuccessResponse('Profile updated successfully', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar
      }
    })
  );
});

// @desc    Upload avatar
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('No file uploaded')
    );
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('User not found')
    );
  }

  // Delete old avatar if exists
  if (user.avatar) {
    try {
      const oldAvatarPath = path.join(__dirname, '../../uploads/avatars', path.basename(user.avatar));
      await fs.unlink(oldAvatarPath);
    } catch (error) {
      logger.warn('Failed to delete old avatar:', error);
    }
  }

  // Update user avatar
  user.avatar = `/uploads/avatars/${req.file.filename}`;
  await user.save();

  await AuditLog.create({
    userId: req.user.id,
    action: 'avatar_uploaded',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`Avatar uploaded for user: ${user.email}`);

  res.json(
    createSuccessResponse('Avatar uploaded successfully', {
      avatar: user.avatar
    })
  );
});

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private (Admin only)
const updateUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, role, isActive } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('User not found')
    );
  }

  // Prevent super admin role changes by non-super admin
  if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      createErrorResponse('Cannot modify super admin user')
    );
  }

  // Prevent role escalation beyond current user's role
  if (role && role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      createErrorResponse('Cannot assign super admin role')
    );
  }

  // Check if email is already taken by another user
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        createErrorResponse('Email is already in use')
      );
    }
  }

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (email) user.email = email;
  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  await AuditLog.create({
    userId: req.user.id,
    action: 'user_updated',
    resourceType: 'User',
    resourceId: user._id,
    details: { 
      updatedFields: Object.keys(req.body),
      targetUser: user.email
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`User updated: ${user.email} by ${req.user.email}`);

  res.json(
    createSuccessResponse('User updated successfully', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    })
  );
});

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('User not found')
    );
  }

  // Prevent deletion of super admin by non-super admin
  if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(HTTP_STATUS.FORBIDDEN).json(
      createErrorResponse('Cannot delete super admin user')
    );
  }

  // Prevent self-deletion
  if (user._id.toString() === req.user.id) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createErrorResponse('Cannot delete your own account')
    );
  }

  // Delete user avatar if exists
  if (user.avatar) {
    try {
      const avatarPath = path.join(__dirname, '../../uploads/avatars', path.basename(user.avatar));
      await fs.unlink(avatarPath);
    } catch (error) {
      logger.warn('Failed to delete user avatar:', error);
    }
  }

  await User.findByIdAndDelete(req.params.id);

  await AuditLog.create({
    userId: req.user.id,
    action: 'user_deleted',
    resourceType: 'User',
    resourceId: user._id,
    details: { 
      deletedUser: user.email,
      deletedUserRole: user.role
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  logger.info(`User deleted: ${user.email} by ${req.user.email}`);

  res.json(
    createSuccessResponse('User deleted successfully')
  );
});

// @desc    Get user statistics
// @route   GET /api/users/:id/stats
// @access  Private (Admin only)
const getUserStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(
      createErrorResponse('User not found')
    );
  }

  // Get test attempt statistics
  const testStats = await TestAttempt.aggregate([
    { $match: { userId: user._id } },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        completedAttempts: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        averageScore: { $avg: '$score' },
        averagePercentage: { $avg: '$percentage' },
        totalTimeSpent: { $sum: '$timeSpent' }
      }
    }
  ]);

  const stats = testStats[0] || {
    totalAttempts: 0,
    completedAttempts: 0,
    averageScore: 0,
    averagePercentage: 0,
    totalTimeSpent: 0
  };

  // Get recent activity
  const recentAttempts = await TestAttempt.find({ userId: user._id })
    .populate('testId', 'title')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('testId score percentage status createdAt');

  res.json(
    createSuccessResponse('User statistics retrieved successfully', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      stats: {
        ...stats,
        averageScore: Math.round(stats.averageScore || 0),
        averagePercentage: Math.round(stats.averagePercentage || 0)
      },
      recentAttempts
    })
  );
});

module.exports = {
  getUsers,
  getUserById,
  updateProfile,
  uploadAvatar,
  updateUser,
  deleteUser,
  getUserStats
};
