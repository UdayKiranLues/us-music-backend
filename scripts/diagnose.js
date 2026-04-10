import mongoose from 'mongoose';
import User from '../src/models/User.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const diagnoseIssue = async () => {
  try {
    console.log('🔍 Diagnosing 500 error...\n');
    
    // Check env vars
    console.log('1️⃣  Checking environment variables:');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
    console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('   VERCEL:', process.env.VERCEL || 'not set');
    
    // Try to connect to MongoDB
    console.log('\n2️⃣  Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ MongoDB connected');
    
    // Check admin user
    console.log('\n3️⃣  Checking admin user:');
    const admin = await User.findOne({ email: 'admin@usmusic.com' });
    
    if (!admin) {
      console.log('   ❌ Admin user not found!');
    } else {
      console.log('   ✅ Admin user found');
      console.log('   📧 Email:', admin.email);
      console.log('   👤 Role:', admin.role);
      console.log('   🔒 Active:', admin.isActive);
      console.log('   🔑 Has password:', !!admin.password);
    }
    
    // Try to verify password
    if (admin) {
      console.log('\n4️⃣  Testing password:');
      try {
        const isValid = await admin.comparePassword('Admin123456');
        console.log('   ✅ Password verification works:', isValid ? 'MATCH ✓' : 'NO MATCH ✗');
      } catch (error) {
        console.log('   ❌ Password verification error:', error.message);
      }
    }
    
    console.log('\n✅ Diagnosis complete');
    
  } catch (error) {
    console.error('\n❌ Diagnostic error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

diagnoseIssue();
