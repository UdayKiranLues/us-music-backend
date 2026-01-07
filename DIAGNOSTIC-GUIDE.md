# Song Playback Diagnostic System

## Overview

This system provides automated diagnostics and self-healing capabilities for song playback. It validates every step of the streaming pipeline and auto-recovers from common failures.

## Architecture

### Backend Validation Pipeline (8 Steps)

Located in: `backend/src/controllers/songController.js` → `getSecureStream()`

```
User Request → Step 1: Validate Song ID
            → Step 2: Fetch from Database
            → Step 3: Check HLS Availability
            → Step 4: Extract S3 Key
            → Step 5: Generate Streaming URL
            → Step 6: Detect CDN Type
            → Step 7: Validate Configuration
            → Step 8: Return with Diagnostics
```

**Error Responses**:
- `400`: Invalid song ID (undefined, null, malformed)
- `404`: Song not found in database
- `422`: HLS stream not available (missing hlsUrl)
- `500`: Internal server error

### Frontend Validation Pipeline (7 Steps)

Located in: `src/context/PlayerContext.jsx` → `fetchSecureStreamUrl()`

```
Play Button → Step 1: Validate Song Object
           → Step 2: Fetch Stream URL
           → Step 3: Validate URL Exists
           → Step 4: Detect Raw S3 URLs
           → Step 5: Validate CloudFront
           → Step 6: Log Diagnostics
           → Step 7: Handle Errors
```

**Auto-Retry Logic**:
- Retries once if S3 URL received (expects CloudFront)
- Max 1 retry to prevent infinite loops
- Returns structured error messages

### HLS Player Retry Logic

Located in: `src/context/PlayerContext.jsx` → `initializeHLS()`

```
Initialize → Configure HLS.js
          → Attach Event Listeners
          → Error Detection
          ├─→ Network Error → Retry with Exponential Backoff
          │                   (1s → 2s → 4s, max 5s)
          │                   Max 2 retries per attempt
          │                   Complete reinitialization on failure
          │
          └─→ Media Error → Recover Media Error
```

**Retry Limits**:
- Max 2 retry attempts per failure type
- Exponential backoff: 1s, 2s, 4s (capped at 5s)
- Complete HLS reinitialization after max retries
- Prevents infinite retry loops

## Automated Testing

### Development Mode Auto-Test

When you start the backend server in development mode (`NODE_ENV=development`), the diagnostic system automatically runs a comprehensive test suite after 2 seconds.

**Test Coverage**:
1. **Configuration Check**: Validates CloudFront, S3, and AWS region setup
2. **Database Connection**: Checks MongoDB connection and song count
3. **Stream Endpoint**: Tests `/api/v1/songs/:id/stream` with a real song
4. **URL Validation**: Validates URL format rules (CloudFront vs S3)

**How to Run**:
```bash
# Backend
cd backend
npm run dev

# Wait 2 seconds, you'll see:
# ════════════════════════════════════════════════════════
#   🔍 SONG PLAYBACK DIAGNOSTIC TEST
# ════════════════════════════════════════════════════════
```

### Manual Testing

You can also run diagnostics manually:

```javascript
// In backend/src/utils/playbackDiagnostic.js
import playbackDiagnostic from './utils/playbackDiagnostic.js';

// Run full diagnostic suite
await playbackDiagnostic.runDiagnostics();

// Test specific song
await playbackDiagnostic.testSongById('60d5ec49f1b2c8b1f8e4e1a1');
```

## Common Issues & Solutions

### Issue 1: Raw S3 URLs Reaching Frontend

**Symptom**:
```
⚠️ Warning: Received S3 URL instead of CloudFront
   This may cause CORS or performance issues
   Expected: https://d123.cloudfront.net/...
   Received: https://bucket.s3.region.amazonaws.com/...
```

**Root Cause**: CloudFront not configured in backend `.env`

**Solution**:
```bash
# Add to backend/.env
CLOUDFRONT_DOMAIN=d123456abcdef.cloudfront.net

# Optionally add key pair for signed URLs
CLOUDFRONT_KEY_PAIR_ID=APKAXXXXXXXX
CLOUDFRONT_PRIVATE_KEY_PATH=./config/cloudfront-private-key.pem
```

**Auto-Recovery**: Frontend automatically retries once if S3 URL received

### Issue 2: Undefined Song ID

**Symptom**:
```
❌ Error: Invalid song ID
   Song ID is undefined or null
```

**Root Cause**: Song object missing `_id` or `id` property

**Solution**:
```javascript
// Ensure song objects have proper ID
const song = {
  _id: '60d5ec49f1b2c8b1f8e4e1a1', // MongoDB ObjectId
  title: 'Song Title',
  artist: 'Artist Name',
  // ... other fields
};
```

**Frontend Validation**: Checks for `song._id || song.id` before playback

### Issue 3: HLS Manifest Not Found

**Symptom**:
```
❌ Error: Song does not have HLS stream available
   Song ID: 60d5ec49f1b2c8b1f8e4e1a1
   Upload status: processing
```

**Root Cause**: Song still processing or conversion failed

**Solution**:
1. Check upload status in admin dashboard
2. Verify FFmpeg is installed: `ffmpeg -version`
3. Check backend logs for conversion errors
4. Re-upload the song if conversion failed

**Backend Validation**: Returns `422 Unprocessable Entity` if HLS missing

### Issue 4: CORS Errors

**Symptom**:
```
Access to XMLHttpRequest at '...' has been blocked by CORS policy
```

**Root Cause**: S3 CORS not configured or CloudFront missing CORS headers

**Solution**:
```bash
# Apply S3 CORS configuration
cd backend/config
./apply-s3-cors.ps1

# Or use CloudFront with proper headers
# See: backend/config/CLOUDFRONT-SETUP.md
```

**HLS.js Configuration**: Already configured with `xhrSetup` and `withCredentials: false`

### Issue 5: Network Errors During Playback

**Symptom**:
```
HLS.js Network Error - Retrying in 1s (Attempt 1/2)
```

**Root Cause**: Transient network issues, DNS resolution failures

**Solution**: No action needed - system auto-retries

**Auto-Recovery**:
1. Retry with `startLoad()` after exponential backoff
2. If max retries exceeded: Complete HLS reinitialization
3. If still failing: Display user-friendly error

### Issue 6: CloudFront Misconfiguration

**Symptom**:
```
⚠️ CloudFront domain not configured
   Using S3 presigned URLs as fallback
   This may cause CORS issues and slower streaming
```

**Root Cause**: `CLOUDFRONT_DOMAIN` missing from `.env`

**Solution**:
```bash
# Follow CloudFront setup guide
cat backend/config/CLOUDFRONT-QUICKSTART.txt

# Add domain to .env
CLOUDFRONT_DOMAIN=d123456abcdef.cloudfront.net
```

**Backend Auto-Detection**: Warns in logs and returns diagnostic info

## Diagnostic Output Examples

### ✅ Successful Configuration

```
════════════════════════════════════════════════════════
  🔍 SONG PLAYBACK DIAGNOSTIC TEST
════════════════════════════════════════════════════════

📋 Test 1: Configuration Check
──────────────────────────────────────────────────────────
✅ CloudFront domain configured: d123456abcdef.cloudfront.net
✅ CloudFront signed URLs enabled
✅ S3 bucket: us-music
✅ AWS region: eu-north-1

🗄️  Test 2: Database Connection
──────────────────────────────────────────────────────────
✅ Connected to MongoDB
   Total songs in database: 12

🎵 Test 3: Stream Endpoint Test
──────────────────────────────────────────────────────────
   Testing with: "Song Title" by Artist Name
   Song ID: 60d5ec49f1b2c8b1f8e4e1a1
   Endpoint: http://localhost:5000/api/v1/songs/60d5ec49f1b2c8b1f8e4e1a1/stream
✅ Stream endpoint responsive
   CDN Type: cloudfront
   Stream URL: https://d123456abcdef.cloudfront.net/songs/abc/hls/playlist.m3u8...
✅ Using CloudFront (optimal)
✅ HLS manifest accessible
   Status: 200

🔗 Test 4: URL Validation Rules
──────────────────────────────────────────────────────────
✅ CloudFront:
   https://d123.cloudfront.net/songs/abc/hls/playlist.m3u8...
   Result: valid (expected: valid)
⚠️ S3 Direct:
   https://bucket.s3.region.amazonaws.com/songs/abc/hls/playlist.m3u8...
   Result: suboptimal (expected: invalid)
❌ Undefined ID:
   http://localhost/songs/undefined/stream...
   Result: invalid (expected: invalid)

════════════════════════════════════════════════════════
  ✅ DIAGNOSTIC TEST COMPLETED
════════════════════════════════════════════════════════
```

### ⚠️ Suboptimal Configuration

```
📋 Test 1: Configuration Check
──────────────────────────────────────────────────────────
⚠️  CloudFront NOT configured
   → Using S3 direct URLs (slower, potential CORS issues)
   → Add CLOUDFRONT_DOMAIN to .env
✅ S3 bucket: us-music
✅ AWS region: eu-north-1

🎵 Test 3: Stream Endpoint Test
──────────────────────────────────────────────────────────
✅ Stream endpoint responsive
   CDN Type: s3
   Stream URL: https://us-music.s3.eu-north-1.amazonaws.com/songs/abc/hls/...
⚠️  Using S3 direct (suboptimal)
⚠️  Warning: CloudFront not configured. Using S3 presigned URLs as fallback.
⚠️  Streaming configuration not optimal
```

### ❌ Error Configuration

```
🗄️  Test 2: Database Connection
──────────────────────────────────────────────────────────
❌ Database connection failed: connect ECONNREFUSED 127.0.0.1:27017

🎵 Test 3: Stream Endpoint Test
──────────────────────────────────────────────────────────
❌ Stream test failed: Request failed with status code 404
   Status: 404
   Error: Song not found
   Diagnostic: { "step": "database_query", "songId": "...", "issue": "not_found" }
```

## Browser Console Logging

When playing a song in the frontend, you'll see detailed logging:

### ✅ Successful Playback

```javascript
// Song validation
▶ [PlayerContext] 🎵 Attempting to play song
  Song: "Song Title" by Artist Name
  ID: 60d5ec49f1b2c8b1f8e4e1a1
  Album: Album Name (2023)

// URL fetching
▶ [PlayerContext] 📡 Fetching secure stream URL
  Song ID: 60d5ec49f1b2c8b1f8e4e1a1
  Retry count: 0

// URL validation
▶ [PlayerContext] ✅ Stream URL validated
  URL type: cloudfront
  URL: https://d123.cloudfront.net/songs/.../playlist.m3u8

// HLS initialization
▶ [PlayerContext] 🎧 Initializing HLS player
  URL: https://d123.cloudfront.net/songs/.../playlist.m3u8
  Retry attempt: 0
```

### ⚠️ Auto-Recovery

```javascript
// S3 URL detected
▶ [PlayerContext] ⚠️ Received S3 URL instead of CloudFront
  This may cause CORS or performance issues
  Retrying request...

// Auto-retry
▶ [PlayerContext] 📡 Fetching secure stream URL
  Song ID: 60d5ec49f1b2c8b1f8e4e1a1
  Retry count: 1

// Success after retry
▶ [PlayerContext] ✅ Stream URL validated
  URL type: cloudfront
```

### ❌ Error with Diagnostics

```javascript
// Song validation error
▶ [PlayerContext] ❌ Invalid song: Song object is missing
  Received: undefined

// Backend error with diagnostics
▶ [PlayerContext] ❌ Failed to fetch stream URL
  Error: Song does not have HLS stream available
  Diagnostic: {
    "step": "hls_validation",
    "songId": "60d5ec49f1b2c8b1f8e4e1a1",
    "issue": "missing_hls_url",
    "uploadStatus": "processing"
  }

// HLS error with recovery
▶ [PlayerContext] ⚠️ HLS.js Network Error - Retrying in 1s (Attempt 1/2)
  Error: Network error
  Possible causes:
  - CORS configuration on CloudFront/S3
  - CloudFront distribution not deployed
  - Network connectivity issues
  - Manifest file missing on S3
```

## Testing Checklist

### Before Deploying

- [ ] Backend diagnostic test passes (auto-runs in dev mode)
- [ ] CloudFront configured in `.env` (or S3 CORS applied)
- [ ] Test playback with valid song → Should play immediately
- [ ] Test playback with invalid ID → Should show clear error
- [ ] Test playback with missing HLS → Should show 422 error
- [ ] Check browser console for clean logs (no unexpected errors)
- [ ] Test network interruption → Should auto-retry with backoff
- [ ] Test S3 URL scenario → Should auto-retry and get CloudFront

### Monitoring in Production

1. **Backend Logs**: Check for validation warnings
   ```bash
   tail -f logs/error.log | grep "⚠️"
   ```

2. **Frontend Console**: Monitor error recovery
   ```javascript
   // Open browser DevTools → Console
   // Filter by: PlayerContext
   ```

3. **Error Rates**: Track 422 responses (missing HLS)
   ```javascript
   // These indicate songs still processing
   ```

4. **Retry Rates**: Monitor auto-retry frequency
   ```javascript
   // High retry rates may indicate:
   // - DNS issues with CloudFront
   // - S3 CORS misconfiguration
   // - Network instability
   ```

## Configuration Priority

The system uses a 3-tier priority for streaming URLs:

1. **CloudFront Signed URLs** (Best)
   - Requires: `CLOUDFRONT_DOMAIN` + key pair
   - Benefits: Secure, fast, CDN-cached
   - Setup: See `backend/config/CLOUDFRONT-SETUP.md`

2. **CloudFront Public URLs** (Good)
   - Requires: `CLOUDFRONT_DOMAIN` only
   - Benefits: Fast, CDN-cached
   - Limitation: No URL security

3. **S3 Presigned URLs** (Fallback)
   - Requires: S3 credentials only
   - Benefits: Works without CloudFront
   - Limitations: Slower, potential CORS issues

## API Reference

### Get Secure Stream URL

```http
GET /api/v1/songs/:id/stream
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "streamUrl": "https://d123.cloudfront.net/songs/.../playlist.m3u8",
    "expiresIn": 3600,
    "cdnType": "cloudfront",
    "diagnostic": {
      "step": "url_generation",
      "cdnType": "cloudfront",
      "isOptimal": true,
      "warning": null
    }
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Invalid song ID",
  "diagnostic": {
    "step": "validation",
    "songId": "undefined",
    "issue": "invalid_song_id"
  }
}
```

**Error Response** (404 Not Found):
```json
{
  "success": false,
  "error": "Song not found",
  "diagnostic": {
    "step": "database_query",
    "songId": "60d5ec49f1b2c8b1f8e4e1a1",
    "issue": "not_found"
  }
}
```

**Error Response** (422 Unprocessable Entity):
```json
{
  "success": false,
  "error": "Song does not have HLS stream available",
  "diagnostic": {
    "step": "hls_validation",
    "songId": "60d5ec49f1b2c8b1f8e4e1a1",
    "issue": "missing_hls_url",
    "uploadStatus": "processing"
  }
}
```

## Related Documentation

- [CloudFront Setup Guide](./config/CLOUDFRONT-SETUP.md)
- [CloudFront Quick Start](./config/CLOUDFRONT-QUICKSTART.txt)
- [S3 CORS Setup](./config/S3-CORS-SETUP.txt)
- [API Documentation](http://localhost:5000/api/docs)

## Troubleshooting Commands

```bash
# Check CloudFront configuration
cd backend/config
./test-cloudfront.ps1

# Apply S3 CORS
./apply-s3-cors.ps1

# Test stream endpoint manually
curl http://localhost:5000/api/v1/songs/SONG_ID/stream

# Check backend logs
cd backend
tail -f logs/combined.log

# Run diagnostic test manually
cd backend
node -e "import('./src/utils/playbackDiagnostic.js').then(m => m.default.runDiagnostics())"
```

## Support

If you encounter issues not covered in this guide:

1. Check backend logs for detailed error messages
2. Run the diagnostic test: `npm run dev` (auto-runs)
3. Check browser console for frontend errors
4. Verify AWS credentials and region configuration
5. Test CloudFront configuration: `./test-cloudfront.ps1`
6. Review [CloudFront Setup Guide](./config/CLOUDFRONT-SETUP.md)
