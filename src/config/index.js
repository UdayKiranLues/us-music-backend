import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate AWS region format
 * Valid format: us-east-1, eu-west-2, ap-south-1, etc.
 */
const validateAwsRegion = (region) => {
  if (!region) return null;
  
  // AWS region format: 2 letter code - region name - number
  // Examples: us-east-1, eu-west-2, ap-south-1
  const regionRegex = /^[a-z]{2}-[a-z]+-\d+$/;
  
  if (!regionRegex.test(region)) {
    console.error('❌ Invalid AWS_REGION format:', region);
    console.error('✅ Valid format examples: us-east-1, eu-west-2, eu-north-1');
    console.error('⚠️  Region must be a code only, not a description');
    throw new Error(
      `Invalid AWS region format: "${region}". ` +
      `Expected format like "us-east-1", not descriptive names. ` +
      `Please check your AWS_REGION environment variable.`
    );
  }
  
  return region;
};

// Validate CloudFront Domain (REQUIRED for production)
const validateCloudFrontDomain = () => {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  
  if (!domain) {
    // In serverless/Vercel, we can use S3 proxy instead
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      throw new Error(
        '❌ CLOUDFRONT_DOMAIN is required in production!\n' +
        '   Songs cannot be streamed without CloudFront.\n' +
        '   Add CLOUDFRONT_DOMAIN to your .env file.\n' +
        '   Example: CLOUDFRONT_DOMAIN=https://d123abc.cloudfront.net'
      );
    }
    console.warn('⚠️  CLOUDFRONT_DOMAIN not configured - using S3 fallback');
    return null;
  }
  
  // Validate format
  if (!domain.includes('cloudfront.net') && !domain.includes('s3.amazonaws.com')) {
    console.warn(`⚠️  Non-standard domain: ${domain}`);
  }
  
  return domain;
};

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/us-music',
    options: {
      maxPoolSize: 10,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
    },
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // CORS
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000', 'https://us-music-frontend.vercel.app'],
  },

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: validateAwsRegion(process.env.AWS_REGION) || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'us-music',
    // CloudFront CDN (REQUIRED for streaming)
    cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN,
    cloudFrontKeyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
    cloudFrontPrivateKey: process.env.CLOUDFRONT_PRIVATE_KEY
      ? process.env.CLOUDFRONT_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Pagination
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE, 10) || 20,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE, 10) || 100,
  },
};

export default config;
