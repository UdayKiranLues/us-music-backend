import request from 'supertest';
import app from '../src/app.js';
import Song from '../src/models/Song.js';
import mongoose from 'mongoose';
import config from '../src/config/index.js';

describe('Diagnostics Endpoints', () => {
  // Mock song data
  const mockSong = {
    title: 'Test Song',
    artist: 'Test Artist',
    genre: ['Pop'],
    language: 'English',
    duration: 180, // 3 minutes
    coverImageUrl: 'https://example.com/cover.jpg',
    hlsUrl: 'https://example.com/hls/playlist.m3u8',
    popularity: 50,
  };

  const mock59SecSong = {
    title: '59 Second Issue Song',
    artist: 'Test Artist',
    genre: ['Pop'],
    language: 'English',
    duration: 59, // Exactly 59 seconds - the bug condition
    coverImageUrl: 'https://example.com/cover.jpg',
    hlsUrl: 'https://example.com/hls/playlist59.m3u8',
    popularity: 50,
  };

  let songId;
  let song59Id;

  beforeAll(async () => {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/us-music-test');
    }

    // Create test songs
    const song = await Song.create(mockSong);
    songId = song._id.toString();

    const song59 = await Song.create(mock59SecSong);
    song59Id = song59._id.toString();
  });

  afterAll(async () => {
    // Cleanup: delete test songs
    await Song.deleteMany({ title: { $in: ['Test Song', '59 Second Issue Song'] } });
  });

  // ==================== Test: Diagnose Song Playback ====================
  describe('GET /api/v1/diagnostics/song/:id', () => {
    test('should return song diagnostics for valid song ID', async () => {
      const response = await request(app).get(`/api/v1/diagnostics/song/${songId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.songId).toBeDefined();
      expect(response.body.data.title).toBe('Test Song');
      expect(response.body.data.duration).toBe(180);
      expect(response.body.data.issues).toBeInstanceOf(Array);
      expect(response.body.data.warnings).toBeInstanceOf(Array);
    });

    test('should NOT show 59-second warning for normal duration song', async () => {
      const response = await request(app).get(`/api/v1/diagnostics/song/${songId}`);

      expect(response.status).toBe(200);
      const issues = response.body.data.issues;
      
      // Should NOT contain 59-second warning
      const has59Warning = issues.some(issue => issue.includes('59 seconds'));
      expect(has59Warning).toBe(false);
    });

    test('should SHOW 59-second warning for songs with exactly 59 second duration', async () => {
      const response = await request(app).get(`/api/v1/diagnostics/song/${song59Id}`);

      expect(response.status).toBe(200);
      const issues = response.body.data.issues;
      
      // Should CONTAIN 59-second warning
      const has59Warning = issues.some(issue => issue.includes('59 seconds'));
      expect(has59Warning).toBe(true);
      
      // Should suggest re-upload
      expect(response.body.data.analysis).toBeDefined();
      expect(response.body.data.analysis.solution).toContain('Re-upload');
    });

    test('should return 404 for non-existent song', async () => {
      const invalidId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/v1/diagnostics/song/${invalidId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 for invalid song ID format', async () => {
      const response = await request(app).get('/api/v1/diagnostics/song/invalid-id');

      expect(response.status).toBe(400);
    });
  });

  // ==================== Test: Check System Health ====================
  describe('GET /api/v1/diagnostics/system', () => {
    test('should return system health status', async () => {
      const response = await request(app).get('/api/v1/diagnostics/system');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.ffmpeg).toBeGreaterThanOrEqual(0);
      expect(response.body.data.storage).toBeGreaterThanOrEqual(0);
      expect(response.body.data.database).toBeDefined();
    });

    test('should include recommendations array', async () => {
      const response = await request(app).get('/api/v1/diagnostics/system');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });
  });

  // ==================== Test: Test Playback ====================
  describe('POST /api/v1/diagnostics/test-playback', () => {
    test('should test playback with valid parameters', async () => {
      const response = await request(app)
        .post('/api/v1/diagnostics/test-playback')
        .send({
          songId: songId,
          duration: 180,
          streamUrl: 'https://example.com/stream.m3u8',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tests).toBeDefined();
      expect(response.body.data.tests.durationCheck).toBeDefined();
    });

    test('should flag song with 59-second duration in test', async () => {
      const response = await request(app)
        .post('/api/v1/diagnostics/test-playback')
        .send({
          songId: song59Id,
          duration: 59,
          streamUrl: 'https://example.com/stream.m3u8',
        });

      expect(response.status).toBe(200);
      const durationCheck = response.body.data.tests.durationCheck;
      expect(durationCheck.status).toBe('CRITICAL');
      expect(durationCheck.message).toContain('59-second');
    });

    test('should warn on very short duration songs', async () => {
      const response = await request(app)
        .post('/api/v1/diagnostics/test-playback')
        .send({
          songId: songId,
          duration: 5,
          streamUrl: 'https://example.com/stream.m3u8',
        });

      expect(response.status).toBe(200);
      const durationCheck = response.body.data.tests.durationCheck;
      expect(durationCheck.status).toBe('WARNING');
    });

    test('should require songId and streamUrl', async () => {
      const response = await request(app)
        .post('/api/v1/diagnostics/test-playback')
        .send({
          duration: 180,
        });

      expect(response.status).toBe(400);
    });

    test('should return available tests for valid input', async () => {
      const response = await request(app)
        .post('/api/v1/diagnostics/test-playback')
        .send({
          songId: songId,
          duration: 180,
          streamUrl: 'https://example.com/stream.m3u8',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.tests.urlAccessibility).toBeDefined();
      expect(response.body.data.tests.durationCheck).toBeDefined();
    });
  });
});
