import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function createAdminCredentials() {
  try {
    console.log('🔐 CREATING NEW ADMIN ACCOUNT IN PRODUCTION');
    console.log('═══════════════════════════════════════════════════════\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to production MongoDB\n');

    const db = mongoose.connection.db;

    // New credentials
    const email = 'uday998588@gmail.com';
    const password = 'Lues@579';
    const username = 'uday998588';
    const name = 'Uday Admin';

    console.log('📝 NEW ADMIN CREDENTIALS:');
    console.log('   Email:', email);
    console.log('   Username:', username);
    console.log('   Password:', password);
    console.log('   Name:', name);
    console.log('');

    // Check if already exists
    const existing = await db.collection('users').findOne({ email: email });
    if (existing) {
      console.log('⚠️  Account already exists. Deleting...');
      await db.collection('users').deleteOne({ email: email });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Password hashed\n');

    // Create admin user
    const result = await db.collection('users').insertOne({
      name: name,
      username: username,
      email: email,
      password: hashedPassword,
      role: 'admin',
      roleSelected: true,
      usernameChanged: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Admin account created with ID:', result.insertedId);

    // Verify it was created correctly
    const newAdmin = await db.collection('users').findOne({ email: email });
    
    console.log('\n📊 VERIFICATION:');
    console.log('   Email:', newAdmin.email);
    console.log('   Username:', newAdmin.username);
    console.log('   Role:', newAdmin.role);
    console.log('   Password hash length:', newAdmin.password.length);
    
    const passwordTest = await bcrypt.compare(password, newAdmin.password);
    console.log('   Password verification:', passwordTest ? '✅ PASS' : '❌ FAIL');

    console.log('\n' + '═'.repeat(55));
    console.log('✅ NEW ADMIN ACCOUNT READY TO TEST');
    console.log('═'.repeat(55));
    console.log('📧 Email:    ' + email);
    console.log('🔑 Password: ' + password);
    console.log('═'.repeat(55));
    console.log('\n⏱️  Changes are live NOW in production database.');
    console.log('🌐 Try logging in immediately: https://us-music-frontend.vercel.app/admin');
    console.log('\n💡 This account will help us test if the Vercel server deployment is working.');

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdminCredentials();
