import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads/temp';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter for audio files
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'];
  const allowedExts = ['.mp3', '.wav'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files (MP3, WAV) are allowed'), false);
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Multer error handler
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 50MB',
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  
  next();
};

// Configure cover image upload
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const coverFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
  }
};

export const uploadCover = multer({
  storage: coverStorage,
  fileFilter: coverFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for images
  },
});

// Combined filter for audio and image files
const combinedFileFilter = (req, file, cb) => {
  const allowedAudioMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'];
  const allowedImageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const audioExts = ['.mp3', '.wav'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check if it's an audio file
  if (file.fieldname === 'audio') {
    if (allowedAudioMimes.includes(file.mimetype) || audioExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV) are allowed for audio field'), false);
    }
  }
  // Check if it's an image file
  else if (file.fieldname === 'cover') {
    if (allowedImageMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed for cover field'), false);
    }
  }
  else {
    cb(new Error('Unexpected field'), false);
  }
};

// Combined upload for audio + cover
export const uploadWithCover = multer({
  storage,
  fileFilter: combinedFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (for audio files)
  },
});

/**
 * Validate AWS configuration before upload
 */
export const validateAWSConfig = async (req, res, next) => {
  const { default: config } = await import('../config/index.js');
  
  if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
    return res.status(500).json({
      success: false,
      error: 'AWS credentials not configured. Please check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.',
    });
  }
  
  if (!config.aws.s3Bucket) {
    return res.status(500).json({
      success: false,
      error: 'S3 bucket not configured. Please check AWS_S3_BUCKET environment variable.',
    });
  }
  
  next();
};

export default upload;
