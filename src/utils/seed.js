import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Create default admin user
 */
export const createAdminUser = async () => {
  try {
    // Check if admin already exists (case-insensitive)
    const adminExists = await User.findOne({ 
      email: { $regex: new RegExp('^admin@usmusic\.com$', 'i') } 
    });
    
    if (adminExists) {
      logger.info('Admin user already exists');
      return adminExists;
    }

    // Create admin user with plain password
    // The User model's pre-save hook will hash it automatically
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@usmusic.com',
      password: 'admin123', // Will be hashed by pre-save hook
      role: 'admin',
      isActive: true,
    });

    logger.info('✅ Default admin user created successfully');
    logger.info('📧 Email: admin@usmusic.com');
    logger.info('🔑 Password: admin123');
    logger.info('⚠️  Please change the password after first login!');
    
    return admin;
  } catch (error) {
    logger.error('Failed to create admin user:', error);
    throw error;
  }
};

/**
 * Create test users
 */
export const createTestUsers = async () => {
  try {
    // Password will be hashed by User model pre-save hook
    
    const testUsers = [
      {
        name: 'Test Artist',
        email: 'artist@usmusic.com',
        password: 'artist123', // Will be hashed by pre-save hook
        role: 'artist',
        isActive: true,
      },
      {
        name: 'Test User',
        email: 'user@usmusic.com',
        password: 'user123', // Will be hashed by pre-save hook
        role: 'user',
        isActive: true,
      },
    ];

    for (const userData of testUsers) {
      const exists = await User.findOne({ email: userData.email });
      if (!exists) {
        await User.create(userData);
        logger.info(`✅ Created ${userData.role}: ${userData.email}`);
      }
    }
  } catch (error) {
    logger.error('Failed to create test users:', error);
    throw error;
  }
};

/**
 * Seed database with initial data
 */
export const seedDatabase = async () => {
  try {
    logger.info('🌱 Seeding database...');

    // Create admin user
    await createAdminUser();

    // Create test users (optional, comment out in production)
    if (config.isDevelopment) {
      await createTestUsers();
    }

    logger.info('✅ Database seeding completed');
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  }
};

/**
 * Clear all data (use with caution!)
 */
export const clearDatabase = async () => {
  try {
    if (!config.isDevelopment) {
      throw new Error('Cannot clear database in production!');
    }

    logger.warn('⚠️  Clearing database...');
    
    await User.deleteMany({});
    
    logger.info('✅ Database cleared');
  } catch (error) {
    logger.error('Failed to clear database:', error);
    throw error;
  }
};

/**
 * Fix admin user - delete and recreate with correct password
 */
export const fixAdminUser = async () => {
  try {
    logger.info('🔧 Fixing admin user...');
    
    // Delete existing admin if exists
    await User.deleteOne({ email: 'admin@usmusic.com' });
    logger.info('Deleted existing admin user');
    
    // Create new admin with correct password hashing
    await createAdminUser();
    
    logger.info('✅ Admin user fixed successfully');
  } catch (error) {
    logger.error('Failed to fix admin user:', error);
    throw error;
  }
};

// Run seeding if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const connectDB = (await import('../config/database.js')).default;
  
  await connectDB();
  await seedDatabase();
  
  mongoose.connection.close();
  process.exit(0);
}
