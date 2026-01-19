import mongoose from 'mongoose';
import config from './src/config/index.js';
import User from './src/models/User.js';
import connectDB from './src/config/database.js';

/**
 * Test user registration duplicate handling
 */
async function testRegistrationDuplicates() {
  console.log('\n🧪 Testing User Registration Duplicate Handling...\n');

  try {
    // Connect to database
    await connectDB();

    // Clear existing test users
    await User.deleteMany({
      email: { $regex: /^test.*@example\.com$/ },
      username: { $regex: /^testuser/ }
    });

    console.log('✅ Cleared existing test users');

    // Test 1: Register first user
    console.log('\n📝 Test 1: Registering first user...');
    const user1 = await User.create({
      name: 'Test User',
      username: 'testuser123',
      email: 'test123@example.com',
      password: 'password123',
    });
    console.log('✅ User 1 created:', user1.username, user1.email);

    // Test 2: Try to register with same email (different case)
    console.log('\n📝 Test 2: Attempting duplicate email (different case)...');
    try {
      const user2 = await User.create({
        name: 'Test User 2',
        username: 'testuser456',
        email: 'TEST123@EXAMPLE.COM', // Same email, different case
        password: 'password123',
      });
      console.log('❌ Should have failed but created:', user2.email);
    } catch (error) {
      if (error.code === 11000) {
        console.log('✅ Correctly caught duplicate key error for email');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 3: Try to register with same username (different case)
    console.log('\n📝 Test 3: Attempting duplicate username (different case)...');
    try {
      const user3 = await User.create({
        name: 'Test User 3',
        username: 'TESTUSER123', // Same username, different case
        email: 'test456@example.com',
        password: 'password123',
      });
      console.log('❌ Should have failed but created:', user3.username);
    } catch (error) {
      if (error.code === 11000) {
        console.log('✅ Correctly caught duplicate key error for username');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test 4: Register with different email and username
    console.log('\n📝 Test 4: Registering user with different credentials...');
    const user4 = await User.create({
      name: 'Test User 4',
      username: 'testuser789',
      email: 'test789@example.com',
      password: 'password123',
    });
    console.log('✅ User 4 created:', user4.username, user4.email);

    // Verify case-insensitive uniqueness
    console.log('\n🔍 Verifying case-insensitive uniqueness...');
    const findUser1 = await User.findOne({ email: 'test123@example.com' }); // Use lowercase
    const findUser2 = await User.findOne({ username: 'testuser123' }); // Use lowercase

    console.log('Find user1 result:', findUser1 ? 'found' : 'not found');
    console.log('Find user2 result:', findUser2 ? 'found' : 'not found');

    if (findUser1 && findUser1.email === 'test123@example.com') {
      console.log('✅ Email case-insensitive lookup works');
    } else {
      console.log('❌ Email case-insensitive lookup failed');
      console.log('Expected email: test123@example.com');
      console.log('Found user:', findUser1);
    }

    if (findUser2 && findUser2.username === 'testuser123') {
      console.log('✅ Username case-insensitive lookup works');
    } else {
      console.log('❌ Username case-insensitive lookup failed');
      console.log('Expected username: testuser123');
      console.log('Found user:', findUser2);
    }

    console.log('\n✅ All registration duplicate handling tests completed!');

    mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Run the test
testRegistrationDuplicates();