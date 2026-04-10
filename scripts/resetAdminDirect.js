import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const resetAdminDirect = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');
    
    const db = mongoose.connection.db;
    
    // Delete existing admin
    console.log('🗑️  Deleting existing admin...');
    await db.collection('users').deleteOne({ email: 'admin@usmusic.com' });
    console.log('✅ Deleted\n');
    
    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash('Admin123456', 12);
    console.log('✅ Password hashed\n');
    
    // Create new admin
    console.log('✨ Creating new admin user...');
    const result = await db.collection('users').insertOne({
      name: 'Admin User',
      username: 'admin',
      email: 'admin@usmusic.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      roleSelected: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Admin user created\n');
    
    // Verify
    console.log('🔍 Verifying...');
    const admin = await db.collection('users').findOne({ email: 'admin@usmusic.com' });
    console.log('📧 Email:', admin.email);
    console.log('👤 Role:', admin.role);
    console.log('🔑 Password set:', !!admin.password);
    console.log('🔐 Password hash length:', admin.password.length);
    
    // Test password
    console.log('\n🧪 Testing password...');
    const isMatch = await bcrypt.compare('Admin123456', admin.password);
    console.log('✅ Password match:', isMatch ? '✓ YES' : '✗ NO');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ ADMIN CREATED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('\nCredentials:');
    console.log('   Email: admin@usmusic.com');
    console.log('   Password: Admin123456');
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

resetAdminDirect();
