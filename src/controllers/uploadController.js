import Song from '../models/Song.js';
import {
  uploadAudioMiddleware,
  uploadWithCoverMiddleware,
  uploadErrorHandler,
} from "../middleware/upload.js";
// import { upload, uploadCover, uploadWithCover, handleMulterError } from '../middleware/upload.js';
import { convertToHLS, getAudioMetadata, validateAudioFile, cleanupFiles } from '../services/ffmpegService.js';
import { uploadHLSToS3, uploadToS3 } from '../utils/s3.js';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/errors.js';

/**
 * Upload and process song
 * POST /api/v1/songs/upload
 */
export const uploadSong = async (req, res, next) => {
  const tempFiles = [];

  try {
    console.log('📦 Received upload request');
    console.log('File:', req.file ? req.file.originalname : 'none');
    console.log('Body:', req.body);

    // Validate request
    if (!req.file) {
      console.error('❌ No audio file in request');
      throw new AppError('No audio file uploaded', 400);
    }

    const { title, artist, genre, mood, bpm, language } = req.body;

    // Validate required fields
    if (!title || !artist || !genre || !language) {
      console.error('❌ Missing required fields');
      throw new AppError('Missing required fields: title, artist, genre, language', 400);
    }

    const audioFile = req.file;
    tempFiles.push(audioFile.path);

    console.log('✅ Audio file uploaded:', audioFile.originalname);

    // Validate audio file
    try {
      await validateAudioFile(audioFile.path);
    } catch (error) {
      console.error('❌ Audio validation failed:', error.message);
      // Check if it's an FFmpeg issue
      if (error.message.includes('FFmpeg') || error.message.includes('ffprobe')) {
        throw new AppError(
          'Server configuration error: FFmpeg is not installed. ' +
          'Please contact the administrator to install FFmpeg for audio processing.',
          500
        );
      }
      throw error;
    }

    // Get audio metadata
    console.log('🔍 Extracting audio metadata...');
    const metadata = await getAudioMetadata(audioFile.path);

    // Convert to HLS
    console.log('🎵 Converting to HLS format...');
    const hlsOutputDir = path.join('uploads', 'hls', `song-${Date.now()}`);
    tempFiles.push(hlsOutputDir);

    const hlsResult = await convertToHLS(audioFile.path, hlsOutputDir);

    // Create temporary song document to get ID
    const tempSong = new Song({
      title,
      artist,
      genre: Array.isArray(genre) ? genre : genre.split(',').map(g => g.trim()),
      mood: mood ? (Array.isArray(mood) ? mood : mood.split(',').map(m => m.trim())) : [],
      bpm: bpm ? parseInt(bpm) : undefined,
      language,
      duration: metadata.duration,
      coverImageUrl: 'https://via.placeholder.com/300', // Temporary placeholder
      hlsUrl: 'temp', // Will be updated after S3 upload
    });

    const songId = tempSong._id.toString();

    // Upload HLS files to S3
    console.log('☁️ Uploading HLS files to S3...');
    const playlistUrl = await uploadHLSToS3(hlsResult.files, songId);

    if (!playlistUrl) {
      throw new AppError('Failed to get HLS playlist URL from S3', 500);
    }

    // Update song with HLS URL
    tempSong.hlsUrl = playlistUrl;

    // Add user who uploaded
    if (req.user && req.user._id) {
      tempSong.createdBy = req.user._id;
    }

    // Save to database
    await tempSong.save();
    
    console.log('✅ Song uploaded successfully:', songId);

    // Cleanup temp files
    await cleanupFiles(tempFiles);

    res.status(201).json({
      success: true,
      message: 'Song uploaded and processed successfully',
      data: {
        song: tempSong,
        metadata: {
          duration: metadata.duration,
          bitrate: metadata.bitrate,
          sampleRate: metadata.sampleRate,
          channels: metadata.channels,
        },
      },
    });
  } catch (error) {
    // Cleanup on error
    if (tempFiles.length > 0) {
      await cleanupFiles(tempFiles);
    }

    console.error('Upload error:', error);
    next(error);
  }
};

/**
 * Upload song with cover image
 * POST /api/v1/songs/upload-with-cover
 */
export const uploadSongWithCover = async (req, res, next) => {
  const tempFiles = [];

  try {
    console.log('📦 Received upload request');
    console.log('Files:', req.files ? Object.keys(req.files) : 'none');
    console.log('Body:', req.body);

    // Validate files exist
    if (!req.files) {
      console.error('❌ No files object in request');
      throw new AppError('No files uploaded', 400);
    }

    // Validate audio file
    if (!req.files.audio || !Array.isArray(req.files.audio) || req.files.audio.length === 0) {
      console.error('❌ No audio file in request');
      throw new AppError('Audio file is required', 400);
    }

    const audioFile = req.files.audio[0];
    const coverFile = req.files.cover && req.files.cover[0] ? req.files.cover[0] : null;

    console.log('✅ Audio file received:', audioFile.originalname);
    if (coverFile) {
      console.log('✅ Cover file received:', coverFile.originalname);
    }

    tempFiles.push(audioFile.path);
    if (coverFile) {
      tempFiles.push(coverFile.path);
    }

    const { title, artist, genre, mood, bpm, language } = req.body;

    // Validate required fields
    if (!title || !artist || !genre || !language) {
      throw new AppError('Missing required fields: title, artist, genre, language', 400);
    }

    console.log('📁 Files uploaded - Audio:', audioFile.path, 'Cover:', coverFile?.path);

    // Validate audio file
    try {
      await validateAudioFile(audioFile.path);
    } catch (error) {
      console.error('❌ Audio validation failed:', error.message);
      // Check if it's an FFmpeg issue
      if (error.message.includes('FFmpeg') || error.message.includes('ffprobe')) {
        throw new AppError(
          'Server configuration error: FFmpeg is not installed. ' +
          'Please contact the administrator to install FFmpeg for audio processing.',
          500
        );
      }
      throw error;
    }

    // Get audio metadata
    console.log('🔍 Extracting audio metadata...');
    const metadata = await getAudioMetadata(audioFile.path);

    // Convert to HLS
    console.log('🎵 Converting to HLS format...');
    const hlsOutputDir = path.join('uploads', 'hls', `song-${Date.now()}`);
    tempFiles.push(hlsOutputDir);

    const hlsResult = await convertToHLS(audioFile.path, hlsOutputDir);

    // Create temporary song document
    const tempSong = new Song({
      title,
      artist,
      genre: Array.isArray(genre) ? genre : genre.split(',').map(g => g.trim()),
      mood: mood ? (Array.isArray(mood) ? mood : mood.split(',').map(m => m.trim())) : [],
      bpm: bpm ? parseInt(bpm) : undefined,
      language,
      duration: metadata.duration,
      coverImageUrl: 'https://via.placeholder.com/300',
      hlsUrl: 'temp',
    });

    const songId = tempSong._id.toString();

    // Upload cover image if provided
    let coverUrl = 'https://via.placeholder.com/300';
    if (coverFile) {
      try {
        console.log('🖼️ Uploading cover image to S3...');
        const coverKey = `songs/${songId}/cover${path.extname(coverFile.originalname)}`;
        const coverBuffer = fs.readFileSync(coverFile.path);
        coverUrl = await uploadToS3(coverBuffer, coverKey, coverFile.mimetype);
        console.log('✅ Cover uploaded:', coverUrl);
      } catch (error) {
        console.error('❌ Cover upload failed:', error.message);
        throw new AppError(`Failed to upload cover image: ${error.message}`, 500);
      }
    }

    // Upload HLS files to S3
    console.log('☁️ Uploading HLS files to S3...');
    const playlistUrl = await uploadHLSToS3(hlsResult.files, songId);

    if (!playlistUrl) {
      throw new AppError('Failed to get HLS playlist URL from S3', 500);
    }
    
    console.log('✅ HLS files uploaded');

    // Update song with URLs
    tempSong.hlsUrl = playlistUrl;
    tempSong.coverImageUrl = coverUrl;

    // Add user who uploaded
    if (req.user && req.user._id) {
      tempSong.createdBy = req.user._id;
    }

    // Save to database
    await tempSong.save();

    console.log('✅ Song with cover uploaded successfully:', songId);

    // Cleanup temp files
    await cleanupFiles(tempFiles);

    res.status(201).json({
      success: true,
      message: 'Song and cover uploaded successfully',
      data: {
        song: tempSong,
        metadata: {
          duration: metadata.duration,
          bitrate: metadata.bitrate,
          sampleRate: metadata.sampleRate,
          channels: metadata.channels,
        },
      },
    });
  } catch (error) {
    // Cleanup on error
    if (tempFiles.length > 0) {
      await cleanupFiles(tempFiles);
    }

    console.error('Upload error:', error);
    next(error);
  }
};

// Middleware exports for routes
// Middleware are exported from ../middleware/upload.js — do not re-declare here.
