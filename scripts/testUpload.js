import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 5000;
const API_URL = `http://localhost:${PORT}/api/v1`;

// Admin credentials
const ADMIN_EMAIL = 'admin@usmusic.com';
const ADMIN_PASSWORD = 'Admin123456';

/**
 * Login and get JWT token
 */
async function login() {
  console.log('🔐 Logging in as admin...');
  
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Login failed: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  
  // Extract token from Set-Cookie header
  const setCookie = response.headers.get('set-cookie');
  const tokenMatch = setCookie?.match(/accessToken=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  if (!token) {
    throw new Error('No token received from login');
  }

  console.log('✅ Login successful!');
  return token;
}

/**
 * Upload a song with cover
 */
async function uploadSong(token, audioPath, coverPath, metadata) {
  console.log('\n📤 Uploading song...');
  console.log('Audio:', audioPath);
  console.log('Cover:', coverPath);

  // Create form data
  const form = new FormData();
  
  // Add files
  form.append('audio', fs.createReadStream(audioPath));
  if (coverPath && fs.existsSync(coverPath)) {
    form.append('cover', fs.createReadStream(coverPath));
  }
  
  // Add metadata
  form.append('title', metadata.title);
  form.append('artist', metadata.artist);
  form.append('genre', metadata.genre);
  form.append('mood', metadata.mood || 'Happy');
  form.append('bpm', metadata.bpm || '120');
  form.append('language', metadata.language || 'English');

  const response = await fetch(`${API_URL}/upload/song-with-cover`, {
    method: 'POST',
    headers: {
      ...form.getHeaders(),
      'Cookie': `accessToken=${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Upload failed: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ Upload successful!');
  console.log('📋 Song details:', JSON.stringify(data, null, 2));
  
  return data;
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('🚀 Starting upload test...\n');

    // Step 1: Login
    const token = await login();

    // Step 2: Prepare test files
    // You can specify your own files here
    const audioFile = process.argv[2] || 'test-audio.mp3';
    const coverFile = process.argv[3] || 'test-cover.jpg';

    if (!fs.existsSync(audioFile)) {
      console.error(`❌ Audio file not found: ${audioFile}`);
      console.log('\nUsage: node scripts/testUpload.js <audio-file> [cover-file]');
      console.log('Example: node scripts/testUpload.js song.mp3 cover.jpg');
      process.exit(1);
    }

    // Step 3: Upload song
    const metadata = {
      title: 'Test Song',
      artist: 'Test Artist',
      genre: 'Pop',
      mood: 'Happy',
      bpm: '128',
      language: 'English',
    };

    await uploadSong(token, audioFile, coverFile, metadata);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
