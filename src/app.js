import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import config from './config/index.js';
import logger from './utils/logger.js';
import { requestLogger, securityLogger } from './middleware/logging.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import songRoutes from './routes/songRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import uploadRoutes from './routes/upload.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import podcastRoutes from './routes/podcastRoutes.js';
import podcastEpisodeRoutes from './routes/podcastEpisodeRoutes.js';
import artistAuthRoutes from './routes/artistAuthRoutes.js';
import artistRoutes from './routes/artistRoutes.js';
import artistPodcastRoutes from './routes/artistPodcastRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// Trust proxy (important for rate limiting behind reverse proxy/load balancer)
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", 'https:'],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow loading external resources
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://us-music-frontend.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow Postman
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Force preflight support
app.options("*", cors());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Rate limiting - General API
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.rateLimitExceeded(req.ip, req.path);
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please slow down',
    });
  },
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful requests
  message: { success: false, error: 'Too many login attempts, please try again later' },
  handler: (req, res) => {
    securityLogger.rateLimitExceeded(req.ip, 'auth');
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again in 15 minutes.',
    });
  },
});

// Upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: { success: false, error: 'Upload limit exceeded' },
  handler: (req, res) => {
    securityLogger.rateLimitExceeded(req.ip, 'upload');
    res.status(429).json({
      success: false,
      error: 'Too many uploads. Please try again later.',
    });
  },
});

app.use('/api/', generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Compression
app.use(compression());

// HTTP request logging with Winston
app.use(morgan('combined', { stream: logger.stream }));

// Custom request/response logger
if (config.isProduction) {
  app.use(requestLogger);
}

// Health check endpoint (liveness probe for K8s/ECS)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// Readiness check endpoint (checks database connection)
app.get('/ready', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const dbState = mongoose.default.connection.readyState;
    
    if (dbState === 1) {
      // 1 = connected
      res.status(200).json({
        status: 'READY',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'NOT_READY',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes
const apiVersion = `/api/${config.apiVersion}`;

app.use(`${apiVersion}/auth`, authLimiter, authRoutes);
app.use(`${apiVersion}/songs`, songRoutes);
app.use(`${apiVersion}/favorites`, favoriteRoutes);
app.use(`${apiVersion}/history`, historyRoutes);
app.use(`${apiVersion}/recommendations`, recommendationRoutes);
app.use(`${apiVersion}/upload`, uploadLimiter, uploadRoutes);
app.use(`${apiVersion}/analytics`, analyticsRoutes);
app.use(`${apiVersion}/podcasts`, podcastRoutes);
app.use(`${apiVersion}`, podcastEpisodeRoutes);
app.use(`${apiVersion}/auth/artist`, artistAuthRoutes);
app.use(`${apiVersion}/artist`, artistRoutes);
app.use(`${apiVersion}/artist`, artistPodcastRoutes);
app.use(`${apiVersion}/admin`, adminRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to US Music API',
    version: config.apiVersion,
    documentation: '/api/docs',
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
