import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI environment variable not set!');
  console.error('⚠️  Please ensure your .env file contains MONGODB_URI');
  process.exit(1);
}

console.log('🔐 PRODUCTION ADMIN PASSWORD RESET');
console.log('===================================');
console.log(`📍 Connecting to: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}`);

async function resetAdminProduction() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to production MongoDB');

    const db = mongoose.connection.db;
    
    // Delete existing admin user(s)
    const deleteResult = await db.collection('users').deleteMany({ 
      $or: [
        { email: 'admin@usmusic.com' },
        { username: 'admin' }
      ]
    });
    console.log(`✅ Deleted: ${deleteResult.deletedCount} user(s)`);

    // Hash the new password
    const password = 'Admin123456';
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Password hashed');

    // Create new admin user with all required fields
    const result = await db.collection('users').insertOne({
      name: 'Admin User',
      username: 'admin',
      email: 'admin@usmusic.com',
      password: hashedPassword,
      role: 'admin',
      roleSelected: true,
      usernameChanged: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Admin user created in production database');

    // Verify the password was set correctly
    const adminUser = await db.collection('users').findOne({ email: 'admin@usmusic.com' });
    
    if (!adminUser.password) {
      console.log('❌ ERROR: Password field is still empty!');
      process.exit(1);
    }

    console.log(`📊 Password field set: TRUE ✓ (${adminUser.password.length} chars)`);

    // Test the password
    const passwordMatch = await bcrypt.compare(password, adminUser.password);
    console.log(`🧪 Password verification: ${passwordMatch ? '✅ PASS' : '❌ FAIL'}`);

    if (passwordMatch) {
      console.log('\n✅ SUCCESS! Admin account is ready.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 Email:    admin@usmusic.com');
      console.log('🔑 Password: Admin123456');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n⏱️  Changes should be live immediately on Vercel.');
      console.log('🌐 Try logging in now: https://your-app.vercel.app/admin');
    } else {
      console.error('❌ Password verification failed!');
      process.exit(1);
    }

    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdminProduction();
