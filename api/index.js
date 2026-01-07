import '../src/config/index.js'; // Load environment variables
import connectDB from '../src/config/database.js';
import app from '../src/app.js';

let isConnected = false;

// Connect to database on cold start
const ensureConnection = async () => {
  if (isConnected) {
    return;
  }
  
  try {
    await connectDB();
    isConnected = true;
    console.log('✅ Database connected (serverless)');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Export handler for Vercel
export default async function handler(req, res) {
  try {
    // Ensure database connection
    await ensureConnection();
    
    // Pass request to Express app
    return app(req, res);
  } catch (error) {
    console.error('❌ Serverless function error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
