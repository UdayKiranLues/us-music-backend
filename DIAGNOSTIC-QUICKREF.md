# Playback Diagnostic System - Quick Reference

## What It Does

✅ **Validates every step** of song playback
✅ **Auto-recovers** from common failures
✅ **Clear error messages** for debugging
✅ **Prevents infinite loops** with retry limits
✅ **Auto-tests** on server startup (dev mode)

## How It Works

### Backend (8-Step Validation)
```
Request → Validate ID → Database → Check HLS → Generate URL
       → Detect CDN → Validate Config → Return Diagnostics
```

### Frontend (7-Step Validation + Retry)
```
Play → Validate Song → Fetch URL → Detect S3 → Validate CloudFront
    → Log Diagnostics → Handle Errors → Auto-Retry (max 1)
```

### HLS Player (Retry Logic)
```
Initialize → Network Error? → Retry with Backoff (1s, 2s, 4s)
                            → Max 2 retries → Reinitialize HLS
          → Media Error? → Recover Media Error
```

## Error Codes

| Code | Error | Meaning |
|------|-------|---------|
| 400 | Invalid song ID | Song ID is undefined, null, or malformed |
| 404 | Song not found | Song doesn't exist in database |
| 422 | HLS not available | Song still processing or conversion failed |
| 500 | Internal error | Server error (check logs) |

## Auto-Recovery Scenarios

### 1. S3 URL Instead of CloudFront
```javascript
⚠️ Received S3 URL, expected CloudFront
→ Auto-retries once to get CloudFront URL
```

### 2. Network Error During Playback
```javascript
⚠️ HLS Network Error
→ Retry #1 after 1s
→ Retry #2 after 2s
→ Reinitialize HLS after 4s
```

### 3. Transient Media Error
```javascript
⚠️ HLS Media Error
→ Recover media error automatically
```

## Testing

### Auto-Test on Server Start
```bash
cd backend
npm run dev

# Wait 2 seconds → Diagnostic test runs automatically
# ════════════════════════════════════════════════════════
#   🔍 SONG PLAYBACK DIAGNOSTIC TEST
# ════════════════════════════════════════════════════════
```

### Manual Test
```bash
cd backend
node -e "import('./src/utils/playbackDiagnostic.js').then(m => m.default.runDiagnostics())"
```

### Test Specific Song
```javascript
// In browser console or backend
import playbackDiagnostic from './utils/playbackDiagnostic.js';
await playbackDiagnostic.testSongById('SONG_ID_HERE');
```

## Common Issues & Quick Fixes

### ⚠️ CloudFront Not Configured
```bash
# backend/.env
CLOUDFRONT_DOMAIN=d123456abcdef.cloudfront.net
```

### ⚠️ CORS Errors
```bash
cd backend/config
./apply-s3-cors.ps1
```

### ⚠️ Song Still Processing
```javascript
// Wait for conversion to complete
// Check admin dashboard → Upload status
// Verify FFmpeg installed: ffmpeg -version
```

### ⚠️ Invalid Song ID
```javascript
// Ensure song object has _id or id property
const song = { _id: '...', title: '...', artist: '...' };
```

## Console Logging

### ✅ Successful Playback
```
▶ [PlayerContext] 🎵 Attempting to play song
  Song: "Title" by Artist
▶ [PlayerContext] ✅ Stream URL validated
  URL type: cloudfront
▶ [PlayerContext] 🎧 Initializing HLS player
```

### ⚠️ Auto-Recovery
```
▶ [PlayerContext] ⚠️ Received S3 URL, retrying...
▶ [PlayerContext] ⚠️ HLS Network Error - Retrying in 1s
```

### ❌ Error with Diagnostics
```
▶ [PlayerContext] ❌ Failed to fetch stream URL
  Error: Song does not have HLS stream available
  Diagnostic: { step: "hls_validation", issue: "missing_hls_url" }
```

## Files Modified

### Backend
- `backend/src/controllers/songController.js` - 8-step validation
- `backend/src/utils/playbackDiagnostic.js` - Diagnostic test suite (NEW)
- `backend/src/server.js` - Auto-run diagnostics in dev mode

### Frontend
- `src/context/PlayerContext.jsx` - Complete validation + retry logic
  - `fetchSecureStreamUrl()` - 7-step validation + auto-retry
  - `playSong()` - Song object validation
  - `initializeHLS()` - Retry logic with exponential backoff

### Documentation
- `backend/DIAGNOSTIC-GUIDE.md` - Complete guide (NEW)
- `backend/DIAGNOSTIC-QUICKREF.md` - This file (NEW)

## Configuration Priority

1. **CloudFront Signed** (Best) → Requires domain + key pair
2. **CloudFront Public** (Good) → Requires domain only
3. **S3 Presigned** (Fallback) → Works without CloudFront

## Retry Limits (Prevents Infinite Loops)

- **Stream URL Fetch**: Max 1 retry (if S3 URL received)
- **HLS Network Error**: Max 2 retries per attempt
- **HLS Reinitialization**: Max 1 complete restart
- **Exponential Backoff**: 1s → 2s → 4s (capped at 5s)

## Diagnostic Test Coverage

1. ✅ Configuration Check (CloudFront, S3, Region)
2. ✅ Database Connection (MongoDB, song count)
3. ✅ Stream Endpoint (Real song test)
4. ✅ URL Validation (Format rules)
5. ✅ Manifest Accessibility (HTTP HEAD request)

## API Endpoint

```http
GET /api/v1/songs/:id/stream
```

**Returns**:
```json
{
  "success": true,
  "data": {
    "streamUrl": "https://...",
    "cdnType": "cloudfront",
    "diagnostic": { "isOptimal": true, "warning": null }
  }
}
```

## Troubleshooting Commands

```bash
# Test CloudFront config
cd backend/config
./test-cloudfront.ps1

# Apply S3 CORS
./apply-s3-cors.ps1

# Test stream endpoint
curl http://localhost:5000/api/v1/songs/SONG_ID/stream

# Check logs
tail -f backend/logs/combined.log

# Run diagnostic test
npm run dev  # Auto-runs after 2s
```

## Related Docs

- Full Guide: [DIAGNOSTIC-GUIDE.md](./DIAGNOSTIC-GUIDE.md)
- CloudFront Setup: [config/CLOUDFRONT-SETUP.md](./config/CLOUDFRONT-SETUP.md)
- Quick Start: [config/CLOUDFRONT-QUICKSTART.txt](./config/CLOUDFRONT-QUICKSTART.txt)
- S3 CORS: [config/S3-CORS-SETUP.txt](./config/S3-CORS-SETUP.txt)

## Testing Checklist

- [ ] Auto-test passes on server start
- [ ] Play valid song → Works immediately
- [ ] Play invalid ID → Shows clear error
- [ ] Play processing song → Shows 422 error
- [ ] Network interruption → Auto-retries
- [ ] S3 URL scenario → Auto-retries for CloudFront
- [ ] Browser console clean (no unexpected errors)

## Support

1. Run diagnostic test: `npm run dev`
2. Check browser console: DevTools → Console → Filter "PlayerContext"
3. Check backend logs: `tail -f backend/logs/combined.log`
4. Review: [DIAGNOSTIC-GUIDE.md](./DIAGNOSTIC-GUIDE.md)
5. Test CloudFront: `./test-cloudfront.ps1`
