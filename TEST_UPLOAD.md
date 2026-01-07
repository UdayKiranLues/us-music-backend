# Quick Test Guide

## Prerequisites

1. ✅ MongoDB connected
2. ✅ AWS S3 bucket configured
3. ✅ FFmpeg installed
4. ✅ Server running (`npm run dev`)

## Test Upload Flow

### 1. Register User (Artist Role)

Since the default role is 'user', you'll need to manually update a user to 'artist' role in MongoDB:

```javascript
// In MongoDB Compass or shell
db.users.updateOne(
  { email: "john@example.com" },
  { $set: { role: "artist" } }
)
```

Or register and update via API:

```bash
# Register
curl -X POST http://localhost:5001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "name": "Artist User",
    "email": "artist@example.com",
    "password": "Password123!"
  }'

# Then manually update role in MongoDB
```

### 2. Login

```bash
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "artist@example.com",
    "password": "Password123!"
  }'
```

### 3. Upload Song

**PowerShell:**
```powershell
curl.exe -X POST http://localhost:5001/api/v1/upload/song `
  -b cookies.txt `
  -F "audio=@song.mp3" `
  -F "title=Test Song" `
  -F "artist=Test Artist" `
  -F "genre=Pop,Dance" `
  -F "mood=happy,energetic" `
  -F "bpm=120" `
  -F "language=English"
```

**CMD:**
```cmd
curl -X POST http://localhost:5001/api/v1/upload/song ^
  -b cookies.txt ^
  -F "audio=@song.mp3" ^
  -F "title=Test Song" ^
  -F "artist=Test Artist" ^
  -F "genre=Pop,Dance" ^
  -F "mood=happy,energetic" ^
  -F "bpm=120" ^
  -F "language=English"
```

### 4. Upload with Cover

```powershell
curl.exe -X POST http://localhost:5001/api/v1/upload/song-with-cover `
  -b cookies.txt `
  -F "audio=@song.mp3" `
  -F "cover=@cover.jpg" `
  -F "title=Summer Vibes" `
  -F "artist=DJ Sunset" `
  -F "genre=Electronic,House" `
  -F "mood=energetic" `
  -F "bpm=128" `
  -F "language=English"
```

### 5. Verify Upload

```bash
# List all songs
curl http://localhost:5001/api/v1/songs

# Get specific song
curl http://localhost:5001/api/v1/songs/{songId}
```

## Expected Response

```json
{
  "success": true,
  "message": "Song uploaded and processed successfully",
  "data": {
    "song": {
      "_id": "65abc123...",
      "title": "Test Song",
      "artist": "Test Artist",
      "genre": ["Pop", "Dance"],
      "mood": ["happy", "energetic"],
      "bpm": 120,
      "language": "English",
      "duration": 180,
      "coverImageUrl": "https://via.placeholder.com/300",
      "hlsUrl": "https://your-bucket.s3.region.amazonaws.com/songs/65abc.../hls/playlist.m3u8",
      "popularity": 0,
      "createdAt": "2026-01-06T..."
    },
    "metadata": {
      "duration": 180,
      "bitrate": "320000",
      "sampleRate": "44100",
      "channels": 2
    }
  }
}
```

## Console Output During Upload

```
📁 Audio file uploaded: uploads/temp/audio-1704556800000-123456789.mp3
🔍 Extracting audio metadata...
🎵 Converting to HLS format...
FFmpeg command: ffmpeg -i uploads/temp/audio-...mp3 ...
Processing: 25% done
Processing: 50% done
Processing: 75% done
Processing: 100% done
HLS conversion completed
☁️ Uploading HLS files to S3...
✅ Song uploaded successfully: 65abc123...
```

## Test Streaming

### Browser Test

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <audio id="audio" controls></audio>
  
  <script>
    const audio = document.getElementById('audio');
    const hlsUrl = 'YOUR_HLS_URL_FROM_RESPONSE';
    
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('Ready to play');
      });
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = hlsUrl;
    }
  </script>
</body>
</html>
```

### Verify HLS Playlist

```bash
# Download and check playlist
curl https://your-bucket.s3.region.amazonaws.com/songs/{id}/hls/playlist.m3u8

# Should show:
# #EXTM3U
# #EXT-X-VERSION:3
# #EXT-X-TARGETDURATION:10
# ...
```

## Troubleshooting

### "FFmpeg not found"

**Windows:**
```powershell
# Check if installed
ffmpeg -version

# If not found, install with Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
# Add to PATH: C:\ffmpeg\bin
```

### "AWS credentials not found"

Check `.env`:
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

### "Access Denied" on S3

1. Check IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket/*",
        "arn:aws:s3:::your-bucket"
      ]
    }
  ]
}
```

2. Make bucket public (or use CloudFront):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket/songs/*"
    }
  ]
}
```

### "Unauthorized" Error

You need artist or admin role. Update in MongoDB:
```javascript
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "artist" } }
)
```

Then logout and login again to refresh token.

## Sample MP3 for Testing

If you don't have a test MP3, you can:

1. Generate silence with FFmpeg:
```bash
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 30 -q:a 2 test-silence.mp3
```

2. Download royalty-free music:
- https://freemusicarchive.org/
- https://www.bensound.com/

3. Use a small MP3 (< 5MB for faster testing)

## Complete Test Script

Save as `test-upload.sh` (Git Bash/Linux) or `test-upload.ps1` (PowerShell):

```bash
#!/bin/bash

echo "🧪 Testing Song Upload"

# 1. Register
echo "1. Registering user..."
curl -X POST http://localhost:5001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"name":"Test Artist","email":"testartist@example.com","password":"Password123!"}'

echo "\n\n⚠️ Please update user role to 'artist' in MongoDB:"
echo "db.users.updateOne({email:'testartist@example.com'},{$set:{role:'artist'}})"
read -p "Press Enter after updating role..."

# 2. Login
echo "\n2. Logging in..."
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"testartist@example.com","password":"Password123!"}'

# 3. Upload
echo "\n\n3. Uploading song..."
curl -X POST http://localhost:5001/api/v1/upload/song \
  -b cookies.txt \
  -F "audio=@test.mp3" \
  -F "title=Test Upload" \
  -F "artist=Test Artist" \
  -F "genre=Pop" \
  -F "language=English"

echo "\n\n✅ Test complete!"
```

## Monitor Server Logs

```bash
npm run dev
```

Watch for:
- ✅ File upload received
- ✅ FFmpeg conversion progress
- ✅ S3 upload success
- ✅ MongoDB save success
- ✅ Temp files cleaned up

## Next Steps

After successful upload:
1. Copy HLS URL from response
2. Test in browser with HLS.js
3. Integrate into your React frontend
4. Add to music player component
