import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from './src/config/index.js';
import User from './src/models/User.js';
import connectDB from './src/config/database.js';

/**
 * Test admin login functionality
 */
async function testAdminLogin() {
  console.log('\n🧪 Testing Admin Login...\n');
  
  try {
    // Connect to database
    await connectDB();
    
    // Find admin user
    const admin = await User.findOne({ email: 'admin@usmusic.com' }).select('+password');
    
    if (!admin) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }
    
    console.log('✅ Admin user found');
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
    console.log('Hashed password:', admin.password.substring(0, 30) + '...');
    
    // Test password comparison
    const testPassword = 'admin123';
    const isValid = await admin.comparePassword(testPassword);
    
    console.log('\n🔑 Password test:');
    console.log('Test password:', testPassword);
    console.log('Is valid:', isValid ? '✅ YES' : '❌ NO');
    
    if (isValid) {
      console.log('\n✅ Admin login test PASSED!');
      console.log('You can now login with:');
      console.log('  Email: admin@usmusic.com');
      console.log('  Password: admin123');
    } else {
      console.log('\n❌ Admin login test FAILED!');
      console.log('Password comparison failed.');
    }
    
    mongoose.connection.close();
    process.exit(isValid ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

testAdminLogin();
