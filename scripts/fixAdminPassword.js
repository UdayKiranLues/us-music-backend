import mongoose from 'mongoose';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const fixAdminPassword = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@usmusic.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found! Creating...');
      const newAdmin = new User({
        name: 'Admin User',
        email: 'admin@usmusic.com',
        password: 'Admin123456',
        role: 'admin',
        isActive: true
      });
      await newAdmin.save();
      console.log('✅ Admin user created successfully');
    } else {
      console.log('✅ Found admin user:', admin.email);
      console.log('📊 Current role:', admin.role);
      console.log('📊 Active status:', admin.isActive);
      
      // Update password and role
      admin.password = 'Admin123456';
      admin.role = 'admin';
      admin.isActive = true;
      admin.roleSelected = true;
      
      await admin.save();
      console.log('✅ Admin password and role reset successfully');
    }

    console.log('\n✅ Admin credentials verified:');
    console.log('📧 Email: admin@usmusic.com');
    console.log('🔑 Password: Admin123456');
    console.log('👤 Role: admin');

    await mongoose.connection.close();
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixAdminPassword();
