import app from '../src/app.js';
import connectDB from '../src/config/database.js';
import logger from '../src/utils/logger.js';

let isConnected = false;

// Connect to database on cold start
const ensureConnection = async () => {
  if (isConnected) {
    return;
  }
  
  try {
    await connectDB();
    isConnected = true;
    logger.info('Database connected (serverless)');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Export the Express app for Vercel
export default async (req, res) => {
  try {
    await ensureConnection();
    return app(req, res);
  } catch (error) {
    logger.error('Serverless function error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};
