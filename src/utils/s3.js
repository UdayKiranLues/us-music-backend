import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import config from '../config/index.js';
import cloudFrontService from '../services/cloudFrontService.js';
import fs from 'fs';

// Log AWS configuration on module load (for debugging)
console.log('🔧 AWS S3 Configuration:');
console.log('   Region:', config.aws.region);
console.log('   Bucket:', config.aws.s3Bucket);
console.log('   Access Key:', config.aws.accessKeyId ? '✅ Configured' : '❌ Missing');

// Create S3 client with AWS SDK v3
const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

/**
 * Validate AWS S3 configuration and connectivity
 */
export const validateS3Config = async () => {
  try {
    // Try to list objects in the bucket (lightweight operation)
    const command = new ListObjectsV2Command({
      Bucket: config.aws.s3Bucket,
      MaxKeys: 1, // Only check connectivity, don't list all objects
    });
    
    await s3Client.send(command);
    console.log('✅ AWS S3 connection validated successfully');
    return true;
  } catch (error) {
    console.error('❌ AWS S3 validation failed:', error.message);
    
    // Provide helpful error messages
    if (error.name === 'InvalidAccessKeyId') {
      console.error('   → Check your AWS_ACCESS_KEY_ID');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.error('   → Check your AWS_SECRET_ACCESS_KEY');
    } else if (error.message.includes('not a valid hostname')) {
      console.error('   → Check your AWS_REGION format (should be like "us-east-1")');
    } else if (error.name === 'NoSuchBucket') {
      console.error('   → Bucket does not exist or wrong region:', config.aws.s3Bucket);
    } else if (error.name === 'AccessDenied') {
      console.error('   → IAM user lacks ListBucket permission');
    }
    
    return false;
  }
};

/**
 * Upload file to S3 with private ACL (for secure streaming)
 */
export const uploadToS3 = async (fileBuffer, key, contentType = 'application/octet-stream', isPublic = false) => {
  try {
    const command = new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      // Private by default for secure streaming
      ...(isPublic && { ACL: 'public-read' }),
    });

    await s3Client.send(command);
    
    // Return CloudFront URL if configured, otherwise S3 URL
    if (cloudFrontService.isConfigured()) {
      return `https://${config.aws.cloudFrontDomain}/${key}`;
    }
    
    return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('❌ S3 upload error:', error.message);
    
    // Provide more context for common errors
    if (error.message.includes('not a valid hostname')) {
      throw new Error('Invalid AWS region format. Check your AWS_REGION environment variable.');
    }
    
    throw new Error(`S3 upload failed: ${error.message}`);
  }
};

/**
 * Upload file stream to S3 (for large files) - PRIVATE by default
 */
export const uploadStreamToS3 = async (filePath, key, contentType = 'application/octet-stream', isPublic = false) => {
  try {
    const fileStream = fs.createReadStream(filePath);
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: config.aws.s3Bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        // Private by default for secure streaming
        ...(isPublic && { ACL: 'public-read' }),
      },
    });

    await upload.done();
    
    // Return CloudFront URL if configured, otherwise S3 URL
    if (cloudFrontService.isConfigured()) {
      return `https://${config.aws.cloudFrontDomain}/${key}`;
    }
    
    return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('S3 stream upload error:', error);
    throw new Error(`S3 stream upload failed: ${error.message}`);
  }
};

/**
 * Upload multiple HLS files to S3 (PRIVATE for secure streaming)
 * Returns S3 key for playlist (not URL - URLs generated on-demand with signing)
 */
export const uploadHLSToS3 = async (files, songId) => {
  try {
    const uploadPromises = files.map(async (file) => {
      const key = `songs/${songId}/hls/${file.name}`;
      const contentType = file.name.endsWith('.m3u8') 
        ? 'application/vnd.apple.mpegurl'
        : 'video/MP2T';
      
      // Upload as private (no public ACL)
      await uploadStreamToS3(file.path, key, contentType, false);
      return key;
    });

    const keys = await Promise.all(uploadPromises);
    
    // Return the playlist S3 key (not URL)
    const playlistKey = keys.find(key => key.endsWith('.m3u8'));
    return playlistKey;
  } catch (error) {
    console.error('HLS upload error:', error);
    throw new Error(`HLS upload to S3 failed: ${error.message}`);
  }
};

/**
 * Generate signed URL for S3 object (fallback when CloudFront not configured)
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export const getSignedS3Url = async (key, expiresIn = 3600) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Failed to generate signed S3 URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Get secure streaming URL (CloudFront signed or S3 presigned)
 * Priority order:
 * 1. CloudFront signed URL (if fully configured with keys)
 * 2. CloudFront public URL (if domain configured)
 * 3. S3 presigned URL (fallback)
 * 
 * @param {string} s3KeyOrUrl - S3 key or full URL
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<string>} Signed URL for streaming
 */
export const getSecureStreamingUrl = async (s3KeyOrUrl, expiresIn = 3600) => {
  try {
    // Extract S3 key if full URL provided
    let s3Key = s3KeyOrUrl;
    if (s3KeyOrUrl.includes('amazonaws.com/') || s3KeyOrUrl.includes('cloudfront.net/')) {
      const parts = s3KeyOrUrl.split('/');
      const songsIndex = parts.indexOf('songs');
      if (songsIndex !== -1) {
        s3Key = parts.slice(songsIndex).join('/');
      }
    }

    console.log(`🔐 Generating streaming URL for: ${s3Key}`);

    // 1. Try CloudFront signed URLs (best option - signed + CDN)
    if (cloudFrontService.isConfigured()) {
      console.log('✅ Using CloudFront signed URL (secure + CDN)');
      return await cloudFrontService.getSignedHLSUrl(s3Key, expiresIn);
    }

    // 2. Try CloudFront public URLs (good option - CDN without signatures)
    if (cloudFrontService.isDomainConfigured()) {
      console.log('✅ Using CloudFront public URL (CDN, no signature)');
      return cloudFrontService.getPublicUrl(s3Key);
    }

    // 3. Fallback to S3 presigned URLs (last resort)
    console.log('⚠️  Falling back to S3 presigned URL (no CDN)');
    return await getSignedS3Url(s3Key, expiresIn);
  } catch (error) {
    console.error('❌ Failed to generate secure streaming URL:', error);
    throw new Error(`Failed to generate secure URL: ${error.message}`);
  }
};

/**
 * Delete file from S3
 */
export const deleteFromS3 = async (fileUrl) => {
  try {
    // Extract key from URL
    const key = fileUrl.split('.amazonaws.com/')[1];

    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`S3 delete failed: ${error.message}`);
  }
};

/**
 * Delete folder from S3 (recursive)
 */
export const deleteFolderFromS3 = async (folderKey) => {
  try {
    // List all objects in folder
    const listCommand = new ListObjectsV2Command({
      Bucket: config.aws.s3Bucket,
      Prefix: folderKey,
    });

    const listResult = await s3Client.send(listCommand);

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return true;
    }

    // Delete all objects
    const deletePromises = listResult.Contents.map(async (obj) => {
      const command = new DeleteObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: obj.Key,
      });
      return s3Client.send(command);
    });

    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error('S3 folder delete error:', error);
    throw new Error(`S3 folder delete failed: ${error.message}`);
  }
};

/**
 * Check if file exists in S3
 */
export const fileExistsInS3 = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

export default s3Client;
