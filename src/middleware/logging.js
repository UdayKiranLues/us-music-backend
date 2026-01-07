import logger from '../utils/logger.js';

/**
 * Request logging middleware
 * Logs all incoming requests with timing information
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.request(req);

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    logger.response(req, res, duration);
    originalSend.call(this, data);
  };

  next();
};

/**
 * Security event logger
 * Logs suspicious activities and security-related events
 */
export const securityLogger = {
  /**
   * Log failed authentication attempts
   */
  failedLogin: (email, ip, reason) => {
    logger.security('Failed Login Attempt', {
      email,
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log rate limit violations
   */
  rateLimitExceeded: (ip, endpoint) => {
    logger.security('Rate Limit Exceeded', {
      ip,
      endpoint,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log invalid tokens
   */
  invalidToken: (ip, reason) => {
    logger.security('Invalid Token', {
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log suspicious file upload attempts
   */
  suspiciousUpload: (userId, filename, reason) => {
    logger.security('Suspicious Upload', {
      userId,
      filename,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log SQL injection or XSS attempts
   */
  injectionAttempt: (ip, endpoint, payload) => {
    logger.security('Injection Attempt', {
      ip,
      endpoint,
      payload: payload.substring(0, 100), // Limit payload logging
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Database operation logger
 */
export const dbLogger = {
  /**
   * Log slow queries
   */
  slowQuery: (model, operation, duration, query) => {
    if (duration > 1000) {
      // Log queries slower than 1 second
      logger.warn('Slow Database Query', {
        model,
        operation,
        duration: `${duration}ms`,
        query,
      });
    }
  },

  /**
   * Log database connection events
   */
  connection: (event, details) => {
    logger.database(event, details);
  },
};

/**
 * Error logging helper
 */
export const logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

export default logger;
