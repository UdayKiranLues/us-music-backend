import User from '../models/User.js';
import { generateTokens } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import config from '../config/index.js';

/**
 * Set JWT tokens in HTTP-only cookies
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: config.isProduction, // HTTPS only in production
    sameSite: config.isProduction ? 'strict' : 'lax',
  };

  // Access token cookie (7 days)
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Refresh token cookie (30 days)
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

/**
 * Clear JWT cookies
 */
const clearTokenCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
};

/**
 * Register a new user
 * @route POST /api/v1/auth/register
 * @access Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError('User already exists', 400);
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Save refresh token to database
  user.refreshToken = refreshToken;
  await user.save();

  // Set tokens in HTTP-only cookies
  setTokenCookies(res, accessToken, refreshToken);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      token: accessToken,
      user: {
        _id: user._id,
        name: user.name || user.username,
        email: user.email,
        role: user.role,
      },
    },
  });
});

/**
 * Login user
 * @route POST /api/v1/auth/login
 * @access Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log('🔐 Login attempt for email:', email);

  // Check if user exists (case-insensitive email)
  const user = await User.findOne({ 
    email: email.toLowerCase() 
  }).select('+password');
  
  if (!user) {
    console.log('❌ User not found for email:', email);
    throw new AppError('Invalid credentials', 401);
  }

  console.log('✅ User found:', user.email, 'Role:', user.role);

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  console.log('🔑 Password validation result:', isPasswordValid);
  
  if (!isPasswordValid) {
    console.log('❌ Invalid password for user:', email);
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403);
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Save refresh token and update last login
  user.refreshToken = refreshToken;
  user.lastLogin = Date.now();
  await user.save();

  // Remove password from response
  user.password = undefined;

  // Set tokens in HTTP-only cookies
  setTokenCookies(res, accessToken, refreshToken);

  console.log('✅ Login successful for:', user.email);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token: accessToken,
      user: {
        _id: user._id,
        name: user.name || user.username,
        email: user.email,
        role: user.role,
      },
    },
  });
});

/**
 * Logout user
 * @route POST /api/v1/auth/logout
 * @access Private
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear refresh token from database
  const user = await User.findById(req.user._id);
  user.refreshToken = undefined;
  await user.save();

  // Clear cookies
  clearTokenCookies(res);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * Get current user
 * @route GET /api/v1/auth/me
 * @access Private
 */
export const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

/**
 * Refresh access token
 * @route POST /api/v1/auth/refresh
 * @access Public
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or body
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  // Find user with this refresh token
  const user = await User.findOne({ refreshToken });
  if (!user) {
    throw new AppError('Invalid refresh token', 401);
  }

  // Generate new tokens
  const tokens = generateTokens(user._id);

  // Update refresh token in database
  user.refreshToken = tokens.refreshToken;
  await user.save();

  // Set new tokens in cookies
  setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
  });
});
