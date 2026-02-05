import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import * as s3Utils from './s3.js';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

/**
 * Validate storage configuration
 */
export const validateStorageConfig = async () => {
    console.log(`🔧 Storage Configuration: Type=${config.storage.type}`);

    if (config.storage.type === 'local') {
        const uploadDir = path.resolve(config.storage.localDir);
        try {
            if (!fs.existsSync(uploadDir)) {
                await mkdir(uploadDir, { recursive: true });
                console.log(`✅ Created local upload directory: ${uploadDir}`);
            } else {
                console.log(`✅ Local upload directory exists: ${uploadDir}`);
            }
            return true;
        } catch (error) {
            console.error(`❌ Failed to setup local storage: ${error.message}`);
            return false;
        }
    } else {
        // Fallback to S3 validation
        return await s3Utils.validateS3Config();
    }
};

/**
 * Upload file to storage (Local or S3)
 * Returns the absolute URL or S3 Key depending on implementation needing the ID
 * For consistency with existing code, we might return the full public URL.
 */
export const uploadFile = async (fileInput, key, contentType, isPublic = false) => {
    if (config.storage.type === 'local') {
        try {
            const fullPath = path.join(config.storage.localDir, key);
            const dir = path.dirname(fullPath);

            await mkdir(dir, { recursive: true });

            if (Buffer.isBuffer(fileInput)) {
                await fs.promises.writeFile(fullPath, fileInput);
            } else {
                // Assume it's a file path
                await copyFile(fileInput, fullPath);
            }

            // Return absolute URL
            // Ensure strictly forward slashes for URLs
            const urlPath = key.replace(/\\/g, '/');
            return `${config.storage.baseUrl}/${config.storage.localDir}/${urlPath}`;
        } catch (error) {
            console.error('Local upload error:', error);
            throw new Error(`Local upload failed: ${error.message}`);
        }
    } else {
        // Delegate to S3
        // Note: s3Utils.uploadToS3 expects buffer. 
        // s3Utils.uploadStreamToS3 expects filePath.
        // We need to handle both provided inputs.

        if (Buffer.isBuffer(fileInput)) {
            return await s3Utils.uploadToS3(fileInput, key, contentType, isPublic);
        } else {
            return await s3Utils.uploadStreamToS3(fileInput, key, contentType, isPublic);
        }
    }
};

/**
 * Upload HLS files
 * Returns playlist URL (or Key if S3)
 */
export const uploadHLS = async (files, contextPath) => {
    if (config.storage.type === 'local') {
        try {
            const uploadPromises = files.map(async (file) => {
                const key = `${contextPath}/${file.name}`;
                await uploadFile(file.path, key, null);
                return key;
            });

            const keys = await Promise.all(uploadPromises);
            const playlistKey = keys.find(k => k.endsWith('.m3u8'));

            // Return full URL for playlist
            const urlPath = playlistKey.replace(/\\/g, '/');
            return `${config.storage.baseUrl}/${config.storage.localDir}/${urlPath}`;
        } catch (error) {
            console.error('Local HLS upload error:', error);
            throw new Error(`Local HLS upload failed: ${error.message}`);
        }
    } else {
        // For S3, we need to parse the contextPath to match what existing s3Utils expect
        // Or refactor usage.
        // Existing s3Utils.uploadHLSToS3 takes (files, songId) and constructs key `songs/${songId}/hls/...`
        // We should probably just expose a similar function or adapt parameters.

        // Let's assume contextPath is like "songs/123/hls"
        // But s3Utils.uploadHLSToS3 takes just ID.
        // To be safe and compatible, let's implement the specific logic here or call s3Utils if it matches pattern.

        // Actually, the calling code passes songId. Let's make this function accept (files, songId, subDir='hls').

        // Wait, looking at current usage in uploadController:
        // uploadHLSToS3(hlsResult.files, songId);

        // We will adapt this function to match that signature
        throw new Error("Direct uploadHLS call not supported in mixed mode yet, use uploadHLSForSong");
    }
};

export const uploadHLSForSong = async (files, songId) => {
    if (config.storage.type === 'local') {
        return uploadHLS(files, `songs/${songId}/hls`);
    } else {
        return await s3Utils.uploadHLSToS3(files, songId);
    }
};

export const deleteFile = async (urlOrKey) => {
    if (config.storage.type === 'local') {
        try {
            // Extract key from URL if it's a URL
            let key = urlOrKey;
            if (urlOrKey.startsWith(config.storage.baseUrl)) {
                key = urlOrKey.replace(`${config.storage.baseUrl}/${config.storage.localDir}/`, '');
            }

            const fullPath = path.join(config.storage.localDir, key);
            if (await exists(fullPath)) {
                await unlink(fullPath);
            }
            return true;
        } catch (error) {
            console.error('Local delete error:', error);
            return false;
        }
    } else {
        return await s3Utils.deleteFromS3(urlOrKey);
    }
};

export default {
    validateStorageConfig,
    uploadFile,
    uploadHLSForSong,
    deleteFile
};
