# Song Upload & Streaming Backend

## Overview

Complete backend implementation for uploading MP3 files, converting to HLS format, and streaming using AWS S3.

## Features

✅ **MP3 Upload** - Accept audio files via multipart/form-data  
✅ **HLS Conversion** - Convert MP3 to HLS (.m3u8 + .ts segments) using FFmpeg  
✅ **AWS S3 Upload** - Upload HLS files to S3 with proper MIME types  
✅ **MongoDB Storage** - Store song metadata and HLS URLs  
✅ **Cover Images** - Optional cover image upload  
✅ **Error Handling** - Comprehensive error handling and cleanup  
✅ **HLS.js Compatible** - Output optimized for HLS.js frontend player  

---

## Tech Stack

- **AWS SDK v3** - `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`
- **FFmpeg** - `fluent-ffmpeg` for audio conversion
- **Multer** - File upload handling
- **Express** - REST API
- **MongoDB** - Metadata storage

---

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Upload MP3 + Metadata
       ▼
┌─────────────────────┐
│  Upload Controller  │
└──────┬──────────────┘
       │ 2. Validate File
       ▼
┌─────────────────────┐
│  FFmpeg Service     │───► Convert to HLS
└──────┬──────────────┘    (.m3u8 + .ts)
       │ 3. HLS Files
       ▼
┌─────────────────────┐
│   S3 Service        │───► Upload to AWS S3
└──────┬──────────────┘
       │ 4. S3 URLs
       ▼
┌─────────────────────┐
│   MongoDB           │───► Store metadata
└─────────────────────┘    + HLS URL

Frontend ◄───── Stream HLS from S3
```

---

## Installation

### 1. Install Dependencies

```bash
npm install
```

New dependencies added:
- `@aws-sdk/client-s3@^3.490.0`
- `@aws-sdk/lib-storage@^3.490.0`
- `fluent-ffmpeg@^2.1.2`

### 2. Install FFmpeg

**Windows:**
```bash
# Download from https://ffmpeg.org/download.html
# Or use Chocolatey
choco install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

Verify installation:
```bash
ffmpeg -version
```

### 3. Configure AWS

Update `.env`:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

**S3 Bucket Configuration:**
1. Create S3 bucket
2. Enable public read access (or use CloudFront)
3. Configure CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## API Endpoints

### 1. Upload Song (Audio Only)

**POST** `/api/v1/upload/song`

**Auth Required:** Yes (Artist/Admin role)

**Content-Type:** `multipart/form-data`

**Form Fields:**
```
audio: File (required) - MP3/WAV file (max 50MB)
title: String (required)
artist: String (required)
genre: String/Array (required) - Comma-separated or array
mood: String/Array (optional) - Comma-separated or array
bpm: Number (optional) - 0-300
language: String (required)
```

**Example (cURL):**
```bash
curl -X POST http://localhost:5001/api/v1/upload/song \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -F "audio=@song.mp3" \
  -F "title=Summer Vibes" \
  -F "artist=DJ Sunset" \
  -F "genre=Electronic,House" \
  -F "mood=energetic,happy" \
  -F "bpm=128" \
  -F "language=English"
```

**Response:**
```json
{
  "success": true,
  "message": "Song uploaded and processed successfully",
  "data": {
    "song": {
      "_id": "65abc...",
      "title": "Summer Vibes",
      "artist": "DJ Sunset",
      "genre": ["Electronic", "House"],
      "mood": ["energetic", "happy"],
      "bpm": 128,
      "language": "English",
      "duration": 195,
      "coverImageUrl": "https://via.placeholder.com/300",
      "hlsUrl": "https://bucket.s3.region.amazonaws.com/songs/65abc.../hls/playlist.m3u8",
      "popularity": 0,
      "createdAt": "2026-01-06T..."
    },
    "metadata": {
      "duration": 195,
      "bitrate": "320000",
      "sampleRate": "44100",
      "channels": 2
    }
  }
}
```

---

### 2. Upload Song with Cover Image

**POST** `/api/v1/upload/song-with-cover`

**Auth Required:** Yes (Artist/Admin role)

**Content-Type:** `multipart/form-data`

**Form Fields:**
```
audio: File (required) - MP3/WAV (max 50MB)
cover: File (optional) - JPEG/PNG/WebP (max 5MB)
title: String (required)
artist: String (required)
genre: String/Array (required)
mood: String/Array (optional)
bpm: Number (optional)
language: String (required)
```

**Example (JavaScript/Fetch):**
```javascript
const formData = new FormData();
formData.append('audio', audioFile);
formData.append('cover', coverImage);
formData.append('title', 'Summer Vibes');
formData.append('artist', 'DJ Sunset');
formData.append('genre', 'Electronic,House');
formData.append('mood', 'energetic,happy');
formData.append('bpm', '128');
formData.append('language', 'English');

const response = await fetch('http://localhost:5001/api/v1/upload/song-with-cover', {
  method: 'POST',
  credentials: 'include', // Include cookies
  body: formData,
});

const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "message": "Song and cover uploaded successfully",
  "data": {
    "song": {
      "_id": "65abc...",
      "title": "Summer Vibes",
      "coverImageUrl": "https://bucket.s3.region.amazonaws.com/songs/65abc.../cover.jpg",
      "hlsUrl": "https://bucket.s3.region.amazonaws.com/songs/65abc.../hls/playlist.m3u8",
      ...
    },
    "metadata": { ... }
  }
}
```

---

## HLS Conversion Details

### FFmpeg Settings

```javascript
{
  audioCodec: 'aac',
  audioBitrate: '128k',
  audioChannels: 2,
  audioFrequency: 44100,
  hlsTime: 10,              // 10-second segments
  hlsListSize: 0,            // Include all segments
  startNumber: 0,            // Start at segment000.ts
  gopSize: 48,               // Keyframe every 48 frames
}
```

### Output Structure

```
songs/
└── {songId}/
    └── hls/
        ├── playlist.m3u8      (HLS master playlist)
        ├── segment000.ts      (10-second chunk)
        ├── segment001.ts
        ├── segment002.ts
        └── ...
```

### playlist.m3u8 Example

```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.000000,
segment000.ts
#EXTINF:10.000000,
segment001.ts
#EXTINF:5.320000,
segment002.ts
#EXT-X-ENDLIST
```

---

## Frontend Integration (HLS.js)

### Install HLS.js

```bash
npm install hls.js
```

### React Component

```jsx
import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

const AudioPlayer = ({ hlsUrl }) => {
  const audioRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest loaded');
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
      };
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      audio.src = hlsUrl;
    }
  }, [hlsUrl]);

  return (
    <audio
      ref={audioRef}
      controls
      preload="metadata"
      className="w-full"
    />
  );
};

export default AudioPlayer;
```

---

## File Upload Component (React)

```jsx
import React, { useState } from 'react';

const SongUploadForm = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.target);

    try {
      const response = await fetch('http://localhost:5001/api/v1/upload/song-with-cover', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        alert('Song uploaded successfully!');
        console.log('Song:', data.data.song);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Audio File (MP3)*</label>
        <input
          type="file"
          name="audio"
          accept="audio/mp3,audio/mpeg"
          required
        />
      </div>

      <div>
        <label>Cover Image</label>
        <input
          type="file"
          name="cover"
          accept="image/jpeg,image/png,image/webp"
        />
      </div>

      <div>
        <label>Title*</label>
        <input type="text" name="title" required />
      </div>

      <div>
        <label>Artist*</label>
        <input type="text" name="artist" required />
      </div>

      <div>
        <label>Genre* (comma-separated)</label>
        <input type="text" name="genre" placeholder="Pop, Dance" required />
      </div>

      <div>
        <label>Mood (comma-separated)</label>
        <input type="text" name="mood" placeholder="happy, energetic" />
      </div>

      <div>
        <label>BPM</label>
        <input type="number" name="bpm" min="0" max="300" />
      </div>

      <div>
        <label>Language*</label>
        <input type="text" name="language" required />
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="btn-primary"
      >
        {uploading ? 'Uploading...' : 'Upload Song'}
      </button>
    </form>
  );
};
```

---

## Error Handling

### Upload Errors

```json
{
  "success": false,
  "error": "Only audio files (MP3, WAV) are allowed"
}
```

```json
{
  "success": false,
  "error": "File too large. Maximum size is 50MB"
}
```

### Conversion Errors

```json
{
  "success": false,
  "error": "FFmpeg conversion failed: Invalid audio format"
}
```

### S3 Errors

```json
{
  "success": false,
  "error": "S3 upload failed: Access Denied"
}
```

---

## File Cleanup

Temporary files are automatically cleaned up:
- Original uploaded MP3
- HLS conversion output directory
- On error: All temporary files deleted

---

## Security

✅ **Authentication Required** - Only artists/admins can upload  
✅ **File Type Validation** - Only audio files accepted  
✅ **File Size Limits** - 50MB audio, 5MB images  
✅ **S3 Security** - Credentials in environment variables  
✅ **Secure Cookies** - JWT tokens in HTTP-only cookies  

---

## Performance

- **Streaming Chunks:** 10-second HLS segments
- **Bitrate:** 128k AAC for optimal quality/size
- **Sample Rate:** 44.1kHz
- **Channels:** Stereo (2)
- **Parallel Uploads:** All HLS segments uploaded to S3 simultaneously

---

## Testing

### 1. Start Server

```bash
npm run dev
```

### 2. Test Upload

```bash
# Register user with artist role first
curl -X POST http://localhost:5001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DJ Artist",
    "email": "dj@example.com",
    "password": "Password123!"
  }'

# Upload song
curl -X POST http://localhost:5001/api/v1/upload/song \
  -H "Cookie: accessToken=YOUR_TOKEN" \
  -F "audio=@test.mp3" \
  -F "title=Test Song" \
  -F "artist=Test Artist" \
  -F "genre=Pop" \
  -F "language=English"
```

### 3. Test Streaming

```bash
# Get song from database
curl http://localhost:5001/api/v1/songs

# Stream HLS playlist
curl https://your-bucket.s3.region.amazonaws.com/songs/{id}/hls/playlist.m3u8
```

---

## Troubleshooting

### FFmpeg Not Found

```
Error: ffmpeg: command not found
```

**Solution:** Install FFmpeg and ensure it's in PATH

### S3 Access Denied

```
Error: S3 upload failed: Access Denied
```

**Solution:** Check AWS credentials and bucket permissions

### CORS Errors

```
Error: CORS policy blocked
```

**Solution:** Configure S3 bucket CORS (see Configuration section)

### Audio Won't Play

**Check:**
1. HLS playlist URL is accessible
2. MIME types correct (.m3u8 = `application/vnd.apple.mpegurl`)
3. S3 bucket has public read access
4. HLS.js properly initialized

---

## Production Deployment

### 1. CloudFront CDN (Recommended)

```
User → CloudFront → S3 Bucket
```

**Benefits:**
- Lower latency
- HTTPS by default
- Cost-effective bandwidth
- Cache HLS segments

### 2. Enable Compression

Already enabled in Express app.

### 3. Monitor Storage

```bash
aws s3 ls s3://your-bucket/songs/ --recursive --summarize
```

### 4. Cleanup Old Songs

Implement lifecycle policies or manual cleanup:

```javascript
import { deleteFolderFromS3 } from './utils/s3.js';

// Delete song and S3 files
await Song.findByIdAndDelete(songId);
await deleteFolderFromS3(`songs/${songId}/`);
```

---

## Cost Estimation (AWS S3)

**Average song:** 3-minute MP3 → 10 HLS segments + playlist

- **Storage:** ~5MB per song = $0.000115/month
- **Transfer:** 100 streams/month = $0.45
- **Requests:** GET requests = $0.004

**1000 songs, 10k streams/month ≈ $50-60/month**

---

## Next Steps

1. ✅ Backend upload implemented
2. 🔲 Add upload progress tracking
3. 🔲 Implement chunked uploads for large files
4. 🔲 Add audio waveform generation
5. 🔲 Implement song transcoding queue (Bull/Redis)
6. 🔲 Add lyrics support
7. 🔲 Implement admin dashboard for uploads

---

## Files Created

- [src/utils/s3.js](src/utils/s3.js) - AWS SDK v3 S3 operations
- [src/services/ffmpegService.js](src/services/ffmpegService.js) - FFmpeg conversion
- [src/middleware/upload.js](src/middleware/upload.js) - Multer configuration
- [src/controllers/uploadController.js](src/controllers/uploadController.js) - Upload logic
- [src/routes/upload.js](src/routes/upload.js) - Upload routes
- [package.json](package.json) - Updated dependencies

---

## Support

For issues:
1. Check FFmpeg installation
2. Verify AWS credentials
3. Check S3 bucket configuration
4. Review server logs
5. Test with small MP3 file first
