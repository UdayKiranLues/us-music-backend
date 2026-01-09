import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * =========================================================
 * Vercel-safe temporary directory
 * ---------------------------------------------------------
 * Only /tmp is writable in serverless environments
 * =========================================================
 */
export const TEMP_UPLOAD_DIR = "/tmp/uploads";

/**
 * Create temp directory lazily (ONLY when needed)
 */
const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
  }
};

/**
 * =========================================================
 * Multer Storage (Audio & Cover)
 * =========================================================
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureTempDir();
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

/**
 * =========================================================
 * Audio File Filter
 * =========================================================
 */
const audioFileFilter = (req, file, cb) => {
  const allowedMimes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
  ];
  const allowedExts = [".mp3", ".wav"];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files (MP3, WAV) are allowed"), false);
  }
};

/**
 * =========================================================
 * Cover Image Filter
 * =========================================================
 */
const coverFileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only image files (JPEG, PNG, WebP) are allowed"),
      false
    );
  }
};

/**
 * =========================================================
 * Combined Audio + Cover Filter
 * =========================================================
 */
const combinedFileFilter = (req, file, cb) => {
  if (file.fieldname === "audio") {
    return audioFileFilter(req, file, cb);
  }

  if (file.fieldname === "cover") {
    return coverFileFilter(req, file, cb);
  }

  cb(new Error("Unexpected field"), false);
};

/**
 * =========================================================
 * Multer Instances
 * =========================================================
 */
export const uploadAudioMiddleware = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
}).single("audio");

export const uploadWithCoverMiddleware = multer({
  storage,
  fileFilter: combinedFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
}).fields([
  { name: "audio", maxCount: 1 },
  { name: "cover", maxCount: 1 },
]);

/**
 * =========================================================
 * Multer Error Handler
 * =========================================================
 */
export const uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 50MB",
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

/**
 * =========================================================
 * AWS Config Validation Middleware
 * =========================================================
 */
export const validateAWSConfig = async (req, res, next) => {
  const { default: config } = await import("../config/index.js");

  if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
    return res.status(500).json({
      success: false,
      error:
        "AWS credentials not configured. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
    });
  }

  if (!config.aws.s3Bucket) {
    return res.status(500).json({
      success: false,
      error:
        "S3 bucket not configured. Check AWS_S3_BUCKET environment variable.",
    });
  }

  next();
};
