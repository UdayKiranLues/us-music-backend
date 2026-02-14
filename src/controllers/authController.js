import User from '../models/User.js';
import ArtistProfile from '../models/ArtistProfile.js';
import { generateTokens } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import config from '../config/index.js';
import { generateUniqueUsername } from '../utils/usernameGenerator.js';

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

  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists by email
  const userExists = await User.findOne({
    email: normalizedEmail
  });
  if (userExists) {
    throw new AppError('User already exists with this email', 400);
  }

  // Generate unique username
  const username = await generateUniqueUsername(name, User);

  // Create user
  let user;
  try {
    user = await User.create({
      name,
      username,
      email: normalizedEmail,
      password,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `${field} already exists`
      });
    }
    throw error;
  }

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
        username: user.username,
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
  const { email, username, password } = req.body;

  const loginField = email || username;
  const query = email
    ? { email: email.toLowerCase() }
    : { username: username.toLowerCase() };

  console.log('🔐 Login attempt for:', loginField);

  // Check if user exists
  const user = await User.findOne(query).select('+password');

  if (!user) {
    console.log('❌ User not found for:', loginField);
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
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      roleSelected: user.roleSelected
    },
    redirectTo: user.role === "artist" ? "/artist/dashboard" : "/home"
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
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      roleSelected: req.user.roleSelected
    },
    redirectTo: req.user.role === "artist" ? "/artist/dashboard" : "/home"
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

/**
 * Choose user role after registration/login
 * @route POST /api/v1/auth/choose-role
 * @access Private
 */
export const chooseRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!['user', 'artist'].includes(role)) {
    throw new AppError('Invalid role. Must be "user" or "artist"', 400);
  }

  const user = req.user;

  // If choosing artist role, create ArtistProfile
  if (role === 'artist') {
    const existingProfile = await ArtistProfile.findOne({ userId: user._id });
    if (!existingProfile) {
      const profile = await ArtistProfile.create({
        userId: user._id,
        artistName: user.name,
      });
      user.artistProfile = profile._id;
    }
  }

  user.role = role;
  user.roleSelected = true;
  await user.save();

  res.json({
    success: true,
    message: 'Role selected successfully',
    data: {
      user: {
        _id: user._id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
        role: user.role,
        artistProfile: user.artistProfile,
      },
    },
  });
});

/**
 * Change username (one-time only)
 * @route PUT /api/v1/auth/username
 * @access Private
 */
export const changeUsername = asyncHandler(async (req, res) => {
  const { newUsername } = req.body;
  const user = req.user;

  // Check if user has already changed username
  if (user.usernameChanged) {
    throw new AppError('Username can only be changed once', 400);
  }

  // Validate new username
  const normalizedUsername = newUsername.toLowerCase().trim();

  if (!normalizedUsername || normalizedUsername.length < 2 || normalizedUsername.length > 100) {
    throw new AppError('Username must be between 2 and 100 characters', 400);
  }

  // Check if username contains only valid characters
  if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
    throw new AppError('Username can only contain letters, numbers, and underscores', 400);
  }

  // Check if username is already taken
  const existingUser = await User.findOne({ username: normalizedUsername });
  if (existingUser && existingUser._id.toString() !== user._id.toString()) {
    throw new AppError('Username already taken', 400);
  }

  // Update username
  user.username = normalizedUsername;
  user.usernameChanged = true;
  await user.save();

  res.json({
    success: true,
    message: 'Username updated successfully',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    },
  });
});

/**
 * Check if username exists (public debug route)
 * @route GET /api/v1/auth/check-username/:username
 * @access Public
 */
export const checkUsername = asyncHandler(async (req, res) => {
  const { username } = req.params;

  // Normalize username to lowercase for case-insensitive search
  const normalizedUsername = username.toLowerCase().trim();

  // Search for user with this username
  const user = await User.findOne({ username: normalizedUsername })
    .select('_id username email createdAt');

  if (user) {
    res.json({
      success: true,
      exists: true,
      data: {
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  } else {
    res.json({
      success: true,
      exists: false,
    });
  }
});

/**
 * Set user role
 * @route PUT /api/v1/auth/set-role
 * @access Private
 */
export const setUserRole = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { role } = req.body;

  if (!["user", "artist"].includes(role)) {
    return res.status(400).json({
      success: false,
      error: "Invalid role selection"
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found"
    });
  }

  // If upgrading to artist, ensure ArtistProfile exists
  if (role === 'artist') {
    const existingProfile = await ArtistProfile.findOne({ userId: user._id });
    if (!existingProfile) {
      console.log('🎨 Creating new ArtistProfile for user:', user._id);
      const profile = await ArtistProfile.create({
        userId: user._id,
        artistName: user.name || user.username,
      });
      user.artistProfile = profile._id;
    }
  }

  user.role = role;
  user.roleSelected = true;
  await user.save();

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found"
    });
  }

  res.json({
    success: true,
    message: "Role updated successfully",
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      roleSelected: user.roleSelected,
    }
  });
});
