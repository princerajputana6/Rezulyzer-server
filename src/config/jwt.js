const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h',
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const generatePasswordResetToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

const generateTokens = (userId) => {
  const accessToken = generateToken({ id: userId });
  const refreshToken = generateRefreshToken({ id: userId });
  return { accessToken, refreshToken };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  generateTokens,
  verifyToken,
  verifyRefreshToken,
  generatePasswordResetToken,
};
