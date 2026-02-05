
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import fs from 'fs';

console.log('FFmpeg Path:', ffmpegPath);
if (ffmpegPath) {
    console.log('Exists:', fs.existsSync(ffmpegPath));
}

console.log('FFprobe Path:', ffprobePath);
if (ffprobePath && ffprobePath.path) {
    console.log('Exists:', fs.existsSync(ffprobePath.path));
}
