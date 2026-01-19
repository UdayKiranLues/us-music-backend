import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get all users (admin only)
 * @route GET /api/v1/admin/users
 * @access Admin
 */
router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find({})
    .select('_id username email role createdAt')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: users.length,
    data: users,
  });
}));

/**
 * Get duplicate users (admin only)
 * @route GET /api/v1/admin/users/duplicates
 * @access Admin
 */
router.get('/users/duplicates', asyncHandler(async (req, res) => {
  // Find duplicates by username
  const usernameDuplicates = await User.aggregate([
    {
      $group: {
        _id: "$username",
        count: { $sum: 1 },
        users: {
          $push: {
            _id: "$_id",
            username: "$username",
            email: "$email",
            createdAt: "$createdAt"
          }
        }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Find duplicates by email
  const emailDuplicates = await User.aggregate([
    {
      $group: {
        _id: "$email",
        count: { $sum: 1 },
        users: {
          $push: {
            _id: "$_id",
            username: "$username",
            email: "$email",
            createdAt: "$createdAt"
          }
        }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      usernameDuplicates,
      emailDuplicates,
    },
  });
}));

/**
 * Delete user (admin only)
 * @route DELETE /api/v1/admin/users/:id
 * @access Admin
 */
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (id === req.user._id.toString()) {
    throw new AppError('Cannot delete your own account', 400);
  }

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'User deleted successfully',
    data: {
      deletedUser: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
    },
  });
}));

export default router;