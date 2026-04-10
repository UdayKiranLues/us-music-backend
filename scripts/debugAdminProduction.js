import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function debugAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to production MongoDB\n');

    const db = mongoose.connection.db;
    
    // Find admin user
    const admin = await db.collection('users').findOne({ email: 'admin@usmusic.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }

    console.log('📊 ADMIN USER DATA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Name:', admin.name);
    console.log('Username:', admin.username);
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
    console.log('Is Active:', admin.isActive);
    console.log('Password Hash Length:', admin.password?.length || 'NONE');
    console.log('Password Hash:', admin.password ? admin.password.substring(0, 20) + '...' : 'NONE');
    console.log('Password is undefined:', admin.password === undefined);
    console.log('Password is null:', admin.password === null);
    console.log('Password is empty string:', admin.password === '');
    console.log('');

    // Test password comparison
    if (!admin.password) {
      console.log('❌ ERROR: Password field is not set!');
      process.exit(1);
    }

    console.log('🔑 TESTING PASSWORD:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const testPassword = 'Admin123456';
    const match = await bcrypt.compare(testPassword, admin.password);
    
    console.log('Input password: "' + testPassword + '"');
    console.log('Hash in DB:', admin.password);
    console.log('bcrypt.compare result:', match);
    
    if (match) {
      console.log('\n✅ PASSWORD MATCHES! Login should work.');
    } else {
      console.log('\n❌ PASSWORD DOES NOT MATCH!');
      console.log('\nTrying to hash the password again to see if it creates a different hash:');
      const newHash = await bcrypt.hash(testPassword, 12);
      console.log('New hash:', newHash);
      const newMatch = await bcrypt.compare(testPassword, newHash);
      console.log('Does new hash match? ', newMatch);
    }

    // Check if there are other admin users
    console.log('\n📋 ALL ADMIN USERS IN DATABASE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const allAdmins = await db.collection('users').find({ role: 'admin' }).toArray();
    console.log(`Found ${allAdmins.length} admin user(s)`);
    allAdmins.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email} (${u.username}) - Password hash: ${u.password ? u.password.substring(0, 20) + '...' : 'NONE'}`);
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugAdmin();
