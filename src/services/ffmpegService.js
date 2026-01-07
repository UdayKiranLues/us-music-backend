import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Check if FFmpeg is installed
let ffmpegAvailable = false;
let ffmpegCheckError = null;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);
/**
 * Check if FFmpeg and FFprobe are installed
 */
export const checkFFmpegAvailability = async () => {
  try {
    if (!ffmpegPath) {
      throw new Error("ffmpeg-static path not found");
    }

    if (!fs.existsSync(ffmpegPath)) {
      throw new Error(`FFmpeg binary not found at ${ffmpegPath}`);
    }

    if (!ffprobePath?.path || !fs.existsSync(ffprobePath.path)) {
      throw new Error(`FFprobe binary not found at ${ffprobePath?.path}`);
    }

    ffmpegAvailable = true;

    console.log("✅ FFmpeg is available via ffmpeg-static");
    console.log("   FFmpeg path:", ffmpegPath);
    console.log("   FFprobe path:", ffprobePath.path);

    return true;
  } catch (error) {
    ffmpegAvailable = false;
    ffmpegCheckError = error.message;

    console.error("❌ FFmpeg not available");
    console.error(error.message);

    return false;
  }
};


// Check on module load
checkFFmpegAvailability();

/**
 * Convert MP3 to HLS format
 * @param {string} inputPath - Path to input MP3 file
 * @param {string} outputDir - Directory for HLS output
 * @returns {Promise<Object>} - HLS files information
 */
export const convertToHLS = (inputPath, outputDir) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if FFmpeg is available
      if (!ffmpegAvailable) {
        return reject(new Error(
          'FFmpeg is not installed or not found in PATH. ' +
          'Please install FFmpeg: ' +
          'Windows: https://ffmpeg.org/download.html or "choco install ffmpeg", ' +
          'macOS: "brew install ffmpeg", ' +
          'Linux: "sudo apt install ffmpeg"'
        ));
      }

      // Create output directory
      await mkdir(outputDir, { recursive: true });

      const playlistName = 'playlist.m3u8';
      const segmentPattern = 'segment%03d.ts';
      const outputPath = path.join(outputDir, playlistName);

      ffmpeg(inputPath)
        // Audio codec settings
        .audioCodec('aac')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        
        // HLS settings for compatibility with HLS.js
        .outputOptions([
          '-f hls',                           // HLS format
          '-hls_time 10',                     // 10 second segments
          '-hls_list_size 0',                 // Include all segments in playlist
          '-hls_segment_type mpegts',         // MPEG-TS segments
          `-hls_segment_filename ${path.join(outputDir, segmentPattern)}`,
          '-start_number 0',                  // Start segment numbering at 0
          '-sc_threshold 0',                  // Disable scene change detection
          '-g 48',                            // GOP size
          '-keyint_min 48',                   // Minimum keyframe interval
          '-hls_allow_cache 1',               // Allow caching
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on('end', async () => {
          try {
            // Get all generated files
            const files = await readdir(outputDir);
            const hlsFiles = files.map(file => ({
              name: file,
              path: path.join(outputDir, file),
            }));

            console.log('HLS conversion completed');
            resolve({
              playlistFile: playlistName,
              segmentPattern,
              files: hlsFiles,
              outputDir,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(new Error(`FFmpeg conversion failed: ${err.message}`));
        })
        .run();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get audio metadata
 */
export const getAudioMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    // Check if FFmpeg is available
    if (!ffmpegAvailable) {
      return reject(new Error(
        'FFmpeg/FFprobe is not installed or not found in PATH. ' +
        'Please install FFmpeg: ' +
        'Windows: https://ffmpeg.org/download.html or "choco install ffmpeg", ' +
        'macOS: "brew install ffmpeg", ' +
        'Linux: "sudo apt install ffmpeg"'
      ));
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to read metadata: ${err.message}`));
      }

      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      if (!audioStream) {
        return reject(new Error('No audio stream found'));
      }

      resolve({
        duration: Math.floor(metadata.format.duration),
        bitrate: metadata.format.bit_rate,
        sampleRate: audioStream.sample_rate,
        channels: audioStream.channels,
        codec: audioStream.codec_name,
        format: metadata.format.format_name,
      });
    });
  });
};

/**
 * Clean up temporary files and directories
 */
export const cleanupFiles = async (paths) => {
  for (const filePath of paths) {
    try {
      const stats = await stat(filePath);
      
      if (stats.isDirectory()) {
        // Delete all files in directory first
        const files = await readdir(filePath);
        await Promise.all(
          files.map(file => unlink(path.join(filePath, file)))
        );
        // Remove directory
        await fs.promises.rmdir(filePath);
      } else {
        // Delete file
        await unlink(filePath);
      }
    } catch (error) {
      console.error(`Failed to cleanup ${filePath}:`, error.message);
    }
  }
};

/**
 * Validate audio file
 */
export const validateAudioFile = async (filePath) => {
  try {
    const metadata = await getAudioMetadata(filePath);
    
    // Validation checks
    if (metadata.duration < 1) {
      throw new Error('Audio file is too short (minimum 1 second)');
    }
    
    if (metadata.duration > 600) {
      throw new Error('Audio file is too long (maximum 10 minutes)');
    }
    
    return true;
  } catch (error) {
    throw new Error(`Audio validation failed: ${error.message}`);
  }
};

export default {
  convertToHLS,
  getAudioMetadata,
  cleanupFiles,
  validateAudioFile,
  checkFFmpegAvailability,
};
