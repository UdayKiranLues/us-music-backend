import mongoose from 'mongoose';
import config from './index.js';

// Cache the database connection in serverless environment
let cachedConnection = null;

const connectDB = async () => {
  // Return cached connection if exists (for serverless)
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('✅ Using cached MongoDB connection');
    return cachedConnection;
  }

  try {
    const conn = await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    cachedConnection = conn;

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
      cachedConnection = null;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Only in non-serverless environment
    if (process.env.VERCEL !== '1') {
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      });
    }

    return conn;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    cachedConnection = null;
    
    // In serverless, throw error instead of exit
    if (process.env.VERCEL === '1') {
      throw error;
    }
    process.exit(1);
  }
};

export default connectDB;
