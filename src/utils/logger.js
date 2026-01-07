import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Winston Logger Configuration
 * - Console output for development
 * - File output with daily rotation for production
 * - Separate error logs
 * - JSON formatting for log aggregation services
 */

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (more readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports array
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: config.isDevelopment ? consoleFormat : logFormat,
    level: config.isDevelopment ? 'debug' : 'info',
  })
);

// File transports (production only)
if (config.isProduction || process.env.ENABLE_FILE_LOGGING === 'true') {
  const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');

  // Combined logs (all levels)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d', // Keep logs for 14 days
      maxSize: '20m', // Rotate at 20MB
      format: logFormat,
      level: 'info',
    })
  );

  // Error logs (errors only)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Keep error logs for 30 days
      maxSize: '20m',
      format: logFormat,
      level: 'error',
    })
  );

  // Access logs for requests
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d', // Keep access logs for 7 days
      maxSize: '50m',
      format: logFormat,
      level: 'http',
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (config.isDevelopment ? 'debug' : 'info'),
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
  // Handle uncaught exceptions
  exceptionHandlers: config.isProduction
    ? [
        new DailyRotateFile({
          filename: path.join(
            process.env.LOGS_DIR || path.join(process.cwd(), 'logs'),
            'exceptions-%DATE%.log'
          ),
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m',
        }),
      ]
    : [],
  // Handle unhandled promise rejections
  rejectionHandlers: config.isProduction
    ? [
        new DailyRotateFile({
          filename: path.join(
            process.env.LOGS_DIR || path.join(process.cwd(), 'logs'),
            'rejections-%DATE%.log'
          ),
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m',
        }),
      ]
    : [],
});

/**
 * Morgan stream for HTTP request logging
 */
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

/**
 * Helper methods for structured logging
 */

// Log database operations
logger.database = (operation, details) => {
  logger.info('Database Operation', {
    operation,
    ...details,
  });
};

// Log API requests (used in middleware)
logger.request = (req, details = {}) => {
  logger.http('API Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?._id,
    ...details,
  });
};

// Log API responses
logger.response = (req, res, duration, details = {}) => {
  logger.http('API Response', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.user?._id,
    ...details,
  });
};

// Log authentication events
logger.auth = (event, details) => {
  logger.info('Auth Event', {
    event,
    ...details,
  });
};

// Log security events
logger.security = (event, details) => {
  logger.warn('Security Event', {
    event,
    ...details,
  });
};

// Log AWS S3 operations
logger.s3 = (operation, details) => {
  logger.info('S3 Operation', {
    operation,
    ...details,
  });
};

// Log FFmpeg operations
logger.ffmpeg = (operation, details) => {
  logger.info('FFmpeg Operation', {
    operation,
    ...details,
  });
};

// Production startup banner
if (config.isProduction) {
  logger.info('='.repeat(60));
  logger.info('🚀 US Music API - Production Mode');
  logger.info('='.repeat(60));
  logger.info(`Node Environment: ${config.env}`);
  logger.info(`API Version: ${config.apiVersion}`);
  logger.info(`Port: ${config.port}`);
  logger.info(`MongoDB: ${config.mongodb.uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
  logger.info('='.repeat(60));
}

export default logger;
