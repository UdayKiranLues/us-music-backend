# FFmpeg Installation Guide for Windows

## Why FFmpeg is Needed

FFmpeg is required to convert MP3 files to HLS format (.m3u8 + .ts segments) for adaptive streaming.

## Installation Options

### Option 1: Chocolatey (Easiest - Recommended)

1. **Install Chocolatey** (if not installed):
   - Open PowerShell as Administrator
   - Run:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Install FFmpeg:**
   ```powershell
   choco install ffmpeg
   ```

3. **Verify installation:**
   ```powershell
   ffmpeg -version
   ```

### Option 2: Manual Installation

1. **Download FFmpeg:**
   - Go to: https://www.gyan.dev/ffmpeg/builds/
   - Download: `ffmpeg-release-essentials.zip`

2. **Extract:**
   - Extract to `C:\ffmpeg\`
   - Should have structure: `C:\ffmpeg\bin\ffmpeg.exe`

3. **Add to PATH:**
   - Press `Win + X` → System
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", find "Path"
   - Click "Edit" → "New"
   - Add: `C:\ffmpeg\bin`
   - Click OK on all dialogs

4. **Restart terminal and verify:**
   ```powershell
   ffmpeg -version
   ```

### Option 3: Scoop Package Manager

```powershell
# Install Scoop
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install FFmpeg
scoop install ffmpeg
```

## Verify Installation

After installation, run:

```powershell
ffmpeg -version
```

Expected output:
```
ffmpeg version 2024.01.06-git-...
configuration: --enable-gpl --enable-libx264 ...
```

## Test FFmpeg

Create a test audio file:

```powershell
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 -q:a 2 test-audio.mp3
```

This creates a 10-second silent MP3 file for testing.

## Troubleshooting

### "ffmpeg not recognized"

**Solution 1:** Restart your terminal/IDE after installation

**Solution 2:** Manually add to PATH (see Option 2 above)

**Solution 3:** Use full path in code:
```javascript
// In ffmpegService.js
import ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
```

### "Missing codec" errors

Make sure you downloaded the **full** or **essentials** build, not the minimal build.

## For Development Only

If you just want to test the upload API without FFmpeg:

1. Comment out HLS conversion in `uploadController.js`
2. Upload file directly to S3
3. Use MP3 URL instead of HLS URL

**Not recommended for production** - HLS provides better streaming experience.

## Cloud Alternative (Production)

For production, consider using AWS MediaConvert or similar services:
- AWS Elastic Transcoder
- AWS MediaConvert
- Cloudinary
- Mux

These handle transcoding in the cloud without requiring FFmpeg on your server.

## Next Steps

After installing FFmpeg:
1. Restart your terminal
2. Restart VS Code (if running)
3. Run `npm run dev`
4. Test upload endpoint

## Alternative: Docker

If you prefer Docker, FFmpeg is already included in official images:

```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "run", "dev"]
```
