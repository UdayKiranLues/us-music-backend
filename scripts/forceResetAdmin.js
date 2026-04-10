import mongoose from 'mongoose';
import User from '../src/models/User.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const forceResetAdmin = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // DELETE existing admin
    console.log('🗑️  Deleting existing admin user...');
    const deleteResult = await User.deleteOne({ email: 'admin@usmusic.com' });
    console.log('✅ Deleted:', deleteResult.deletedCount, 'user(s)\n');
    
    // CREATE new admin from scratch
    console.log('✨ Creating fresh admin user...');
    const adminData = {
      name: 'Admin User',
      username: 'admin',
      email: 'admin@usmusic.com',
      password: 'Admin123456',  // Will be hashed by pre-save hook
      role: 'admin',
      isActive: true,
      roleSelected: true
    };
    
    const admin = new User(adminData);
    await admin.save();
    
    console.log('✅ New admin user created!\n');
    
    // VERIFY
    console.log('🔍 Verifying admin user...');
    const verifyAdmin = await User.findOne({ email: 'admin@usmusic.com' });
    console.log('📧 Email:', verifyAdmin.email);
    console.log('👤 Role:', verifyAdmin.role);
    console.log('🔒 Active:', verifyAdmin.isActive);
    console.log('🔑 Has password:', !!verifyAdmin.password);
    console.log('🔐 Password hash starts with:', verifyAdmin.password ? verifyAdmin.password.substring(0, 10) : 'NONE');
    
    // TEST password
    console.log('\n🧪 Testing password comparison...');
    const isMatch = await verifyAdmin.comparePassword('Admin123456');
    console.log('✅ Password test result:', isMatch ? '✓ MATCH' : '✗ NO MATCH');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ ADMIN RESET COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📋 Credentials:');
    console.log('   Email: admin@usmusic.com');
    console.log('   Password: Admin123456');
    console.log('   Role: admin');
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

forceResetAdmin();
