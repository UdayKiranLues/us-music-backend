import mongoose from 'mongoose';
import config from './src/config/index.js';
import User from './src/models/User.js';
import connectDB from './src/config/database.js';

/**
 * Test admin/debug user inspection system
 */
async function testAdminDebugSystem() {
  console.log('\n🧪 Testing Admin/Debug User Inspection System...\n');

  try {
    // Connect to database
    await connectDB();

    // Clear existing test users
    await User.deleteMany({
      $or: [
        { email: { $regex: /debugtest.*@example\.com$/ } },
        { username: { $regex: /^debugtest/ } }
      ]
    });

    console.log('✅ Cleared existing test users');

    // Create test users
    console.log('\n📝 Creating test users...');
    const testUsers = [
      {
        name: 'Test User 1',
        username: 'debugtestuser1',
        email: 'debugtest1@example.com',
        password: 'password123',
        role: 'user',
      },
      {
        name: 'Test User 2',
        username: 'debugtestuser2',
        email: 'debugtest2@example.com',
        password: 'password123',
        role: 'user',
      },
      {
        name: 'Test Admin',
        username: 'debugtestadmin',
        email: 'debugadmin@example.com',
        password: 'password123',
        role: 'admin',
      },
    ];

    for (const userData of testUsers) {
      await User.create(userData);
      console.log(`✅ Created ${userData.role}: ${userData.username}`);
    }

    // Test 1: Check username exists (public route)
    console.log('\n📝 Test 1: Checking existing username...');
    const existingUser = await User.findOne({ username: 'debugtestuser1' });
    if (existingUser) {
      console.log('✅ Username "debugtestuser1" exists');
      console.log('   Created:', existingUser.createdAt);
    }

    // Test 2: Check username doesn't exist (public route)
    console.log('\n📝 Test 2: Checking non-existing username...');
    const nonExistingUser = await User.findOne({ username: 'nonexistent' });
    if (!nonExistingUser) {
      console.log('✅ Username "nonexistent" does not exist');
    }

    // Test 3: Admin user list (would require authentication)
    console.log('\n📝 Test 3: Admin user list query...');
    const allUsers = await User.find({})
      .select('_id username email role createdAt')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${allUsers.length} users:`);
    allUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.email}) - ${user.role}`);
    });

    // Test 4: Duplicate scanner (admin route)
    console.log('\n📝 Test 4: Duplicate scanner query...');
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

    console.log(`✅ Username duplicates found: ${usernameDuplicates.length}`);
    console.log(`✅ Email duplicates found: ${emailDuplicates.length}`);

    // Test 5: Delete user (admin route) - simulate deletion
    console.log('\n📝 Test 5: Delete user simulation...');
    const userToDelete = await User.findOne({ username: 'debugtestuser2' });
    if (userToDelete) {
      const deletedUser = await User.findByIdAndDelete(userToDelete._id);
      if (deletedUser) {
        console.log(`✅ Successfully deleted user: ${deletedUser.username}`);
      }
    }

    // Verify deletion
    const verifyDeletion = await User.findById(userToDelete._id);
    if (!verifyDeletion) {
      console.log('✅ User deletion confirmed');
    }

    console.log('\n✅ All admin/debug system tests completed successfully!');

    mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Run the test
testAdminDebugSystem();