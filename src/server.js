import app from './app.js';
import connectDB from './config/database.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import { fixAdminUser } from './utils/seed.js';
import { checkFFmpegAvailability } from './services/ffmpegService.js';
import { validateS3Config } from './utils/s3.js';
import { runDiagnosticsOnStartup } from './utils/playbackDiagnostic.js';

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Connect to database and seed admin user
const startServer = async () => {
  await connectDB();
  
  // Fix admin user (delete and recreate with correct password)
  await fixAdminUser();

  // Check FFmpeg availability
  const ffmpegAvailable = await checkFFmpegAvailability();
  if (!ffmpegAvailable) {
    console.warn('\n⚠️  WARNING: FFmpeg is not installed!');
    console.warn('Audio upload and conversion features will not work.');
    console.warn('Please install FFmpeg to enable these features.\n');
  }

  // Validate AWS S3 configuration
  const s3Valid = await validateS3Config();
  if (!s3Valid) {
    console.warn('\n⚠️  WARNING: AWS S3 configuration is invalid!');
    console.warn('File uploads will not work until AWS credentials are properly configured.\n');
  }

  // Start server
  const server = app.listen(config.port, () => {
    if (config.isProduction) {
      logger.info('Server started successfully', {
        port: config.port,
        environment: config.env,
        apiVersion: config.apiVersion,
        nodeVersion: process.version,
        pid: process.pid,
      });
    } else {
      console.log(`
╔════════════════════════════════════════╗
║                                        ║
║    🎵 US Music API Server              ║
║    Environment: ${config.env.padEnd(24)}║
║    Port: ${String(config.port).padEnd(30)}║
║    API Version: ${config.apiVersion.padEnd(25)}║
║                                        ║
╚════════════════════════════════════════╝
  `);
      console.log(`🚀 Server running on http://localhost:${config.port}`);
      console.log(`📚 API Documentation: http://localhost:${config.port}/api/docs`);
      console.log(`✅ Health check: http://localhost:${config.port}/health`);
      console.log(`🔍 Ready check: http://localhost:${config.port}/ready\n`);
    }

    // Run automated diagnostics in development
    // DISABLED: Diagnostics causing server shutdown
    // if (config.isDevelopment) {
    //   runDiagnosticsOnStartup();
    // }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', {
      error: err.message,
      stack: err.stack,
    });
    server.close(() => {
      process.exit(1);
    });
  });

  // Graceful shutdown on SIGTERM (Docker, Kubernetes, etc.)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connection
      import('mongoose').then((mongoose) => {
        mongoose.default.connection.close(false, () => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  });

  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
};

// Start the server
startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
