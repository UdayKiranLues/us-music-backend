import connectDB from './src/config/database.js';
import User from './src/models/User.js';
import mongoose from 'mongoose';

const testAdmin = async () => {
  try {
    await connectDB();
    const admin = await User.findOne({ email: 'admin@usmusic.com' }).select('+password');
    if (!admin) {
      console.log('❌ Admin not found in DB!');
    } else {
      console.log('✅ Admin found:', admin.email, '| Role:', admin.role);
      const isMatch = await admin.comparePassword('admin123');
      console.log('🔑 Password match for "admin123":', isMatch);
      // Wait, could it be the wrong login route being used?
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
  }
};

testAdmin();
