import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Import the actual User model
import User from '../src/models/User.js';

dotenv.config();

async function testLoginExact() {
  try {
    console.log('🧪 MIMICKING EXACT LOGIN PROCESS');
    console.log('═══════════════════════════════════════════════════════\n');

    // Connect exactly like the app does
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Simulate login request
    const email = 'admin@usmusic.com';
    const password = 'Admin123456';

    console.log('📝 TEST INPUTS:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Password length:', password.length);
    console.log('');

    // Step 2: Find user exactly like login endpoint does
    console.log('🔍 Finding user with query: { email: "" + email.toLowerCase() + "" }');
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      console.log('❌ USER NOT FOUND!');
      process.exit(1);
    }

    console.log('✅ User found');
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Has password:', !!user.password);
    console.log('   Password type:', typeof user.password);
    console.log('   Password length:', user.password?.length);
    console.log('');

    // Step 3: Call comparePassword exactly like login endpoint does
    console.log('🔐 Calling user.comparePassword("' + password + '")');
    let isPasswordValid;
    try {
      isPasswordValid = await user.comparePassword(password);
      console.log('✅ comparePassword completed');
    } catch (err) {
      console.log('❌ comparePassword threw error:', err.message);
      throw err;
    }

    console.log('   Result:', isPasswordValid);
    console.log('');

    // Step 4: Direct bcrypt test for comparison
    console.log('🔬 Direct bcrypt.compare test:');
    if (user.password) {
      const directResult = await bcrypt.compare(password, user.password);
      console.log('   bcrypt.compare result:', directResult);
      console.log('');
    }

    // Step 5: Show what should happen
    if (isPasswordValid) {
      console.log('✅✅✅ LOGIN SHOULD SUCCEED ✅✅✅');
      console.log('If you\'re still getting 401, the problem is NOT the password.');
    } else {
      console.log('❌❌❌ LOGIN WILL FAIL ❌❌❌');
      console.log('The password does not match. Possible causes:');
      console.log('  1. Wrong password stored in database');
      console.log('  2. Password got double-hashed');
      console.log('  3. Mongoose is transforming the password somehow');
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testLoginExact();
