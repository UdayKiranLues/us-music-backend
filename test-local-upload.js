import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_FILE_PATH = path.join(__dirname, 'test-audio.mp3');

// Create a dummy mp3 if not exists
if (!fs.existsSync(TEST_FILE_PATH)) {
    fs.writeFileSync(TEST_FILE_PATH, 'dummy audio content');
}

const uploadSong = async () => {
    try {
        console.log('🚀 Testing Local Upload...');

        // Ensure server is running
        try {
            await axios.get('http://localhost:5000/health');
        } catch (e) {
            console.error('❌ Server not accessible at http://localhost:5000. Is it running?');
            process.exit(1);
        }

        const formData = new FormData();
        formData.append('title', 'Local Test Song');
        formData.append('artist', 'Local Artist');
        formData.append('genre', 'Test');
        formData.append('language', 'English');
        // formData.append('duration', '180'); 
        // Note: Backend extracts duration using ffmpeg. Dummy file might fail validation.
        // We need a real small MP3 or mock valid one.
        // The current test-audio.mp3 in root exists (126 bytes). Let's use that.

        const realTestFile = path.join(__dirname, 'sample.mp3');
        if (fs.existsSync(realTestFile)) {
            formData.append('audio', fs.createReadStream(realTestFile));
        } else {
            console.error("❌ test-audio.mp3 not found!");
            process.exit(1);
        }

        // We need auth token?
        // The route is protected: authenticate, authorize('artist', 'admin')
        // We need to login as admin first.

        console.log('🔑 Logging in as admin...');
        const loginRes = await axios.post('http://localhost:5000/api/v1/auth/login', {
            email: 'admin@usmusic.com',
            password: 'admin123'
        });

        const token = loginRes.data.token;
        console.log('✅ Logged in');

        console.log('📤 Uploading song...');
        const response = await axios.post('http://localhost:5000/api/v1/upload/song', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Upload response:', response.status);
        console.log('Data:', response.data);

        if (response.data.data.song.hlsUrl.startsWith('http://localhost:5000/uploads')) {
            console.log('✅ Success! HLS URL is local:', response.data.data.song.hlsUrl);
        } else {
            console.log('⚠️  Warning: HLS URL might not be local:', response.data.data.song.hlsUrl);
        }

    } catch (error) {
        if (error.response) {
            console.error('❌ Upload failed:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
};

uploadSong();
