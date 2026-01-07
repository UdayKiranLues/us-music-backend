import mongoose from 'mongoose';
import Analytics from '../src/models/Analytics.js';
import Song from '../src/models/Song.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const testAnalytics = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Create test songs
    console.log('📀 Creating test songs...');
    const songs = await Song.insertMany([
      {
        title: 'Analytics Test Song 1',
        artist: 'Test Artist 1',
        genre: ['Pop', 'Electronic'],
        language: 'English',
        duration: 210,
        album: 'Test Album 1',
        coverImageUrl: 'https://example.com/cover1.jpg',
        hlsUrl: 'https://example.com/song1.m3u8',
      },
      {
        title: 'Analytics Test Song 2',
        artist: 'Test Artist 2',
        genre: ['Rock'],
        language: 'English',
        duration: 180,
        album: 'Test Album 1',
        coverImageUrl: 'https://example.com/cover2.jpg',
        hlsUrl: 'https://example.com/song2.m3u8',
      },
    ]);
    console.log(`✅ Created ${songs.length} test songs\n`);

    // Simulate plays for last 7 days
    console.log('🎵 Simulating play events...');
    const userIds = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
    ];

    let totalPlays = 0;
    
    for (let day = 6; day >= 0; day--) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      date.setHours(0, 0, 0, 0);

      // Random plays for each song
      for (const song of songs) {
        const playsForDay = Math.floor(Math.random() * 50) + 10; // 10-60 plays per day
        
        for (let i = 0; i < playsForDay; i++) {
          const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
          const completed = Math.random() > 0.3; // 70% completion rate
          const source = ['search', 'recommendation', 'playlist', 'direct'][
            Math.floor(Math.random() * 4)
          ];

          await Analytics.recordPlay(song._id, randomUser, {
            playDuration: completed ? song.duration : Math.floor(song.duration * 0.5),
            completed,
            source,
            album: song.album,
          });

          totalPlays++;
        }
      }
    }
    console.log(`✅ Simulated ${totalPlays} play events\n`);

    // Update song counters
    console.log('🔄 Updating song counters...');
    for (const song of songs) {
      const analytics = await Analytics.find({ song: song._id });
      const totalPlays = analytics.reduce((sum, a) => sum + a.plays, 0);
      
      const uniqueListeners = new Set();
      analytics.forEach((a) => {
        a.uniqueListeners.forEach((listener) => uniqueListeners.add(listener.toString()));
      });

      await Song.findByIdAndUpdate(song._id, {
        totalPlays,
        uniqueListeners: uniqueListeners.size,
        lastPlayedAt: new Date(),
      });
    }
    console.log('✅ Updated song counters\n');

    // Test analytics queries
    console.log('📊 Testing Analytics Queries:\n');

    // 1. Top Songs
    console.log('1️⃣  Top Songs (Last 7 Days):');
    const topSongs = await Analytics.getTopSongs(5);
    topSongs.forEach((song, index) => {
      console.log(`   ${index + 1}. ${song.title} by ${song.artist}`);
      console.log(`      Plays: ${song.totalPlays}, Unique Listeners: ${song.totalUniqueListeners}`);
      console.log(`      Completion Rate: ${song.completionRate}%\n`);
    });

    // 2. Top Albums
    console.log('2️⃣  Top Albums (Last 7 Days):');
    const topAlbums = await Analytics.getTopAlbums(5);
    topAlbums.forEach((album, index) => {
      console.log(`   ${index + 1}. ${album.album}`);
      console.log(`      Plays: ${album.totalPlays}, Songs: ${album.songCount}\n`);
    });

    // 3. Daily Trend
    console.log('3️⃣  Daily Trend (Last 7 Days):');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    
    const dailyTrend = await Analytics.getDailyTrend(startDate, endDate);
    dailyTrend.forEach((day) => {
      console.log(`   ${day.date}: ${day.totalPlays} plays, ${day.uniqueListeners} listeners`);
    });
    console.log();

    // 4. Overall Stats
    console.log('4️⃣  Overall Statistics:');
    const stats = await Analytics.getOverallStats(startDate, endDate);
    console.log(`   Total Plays: ${stats.totalPlays}`);
    console.log(`   Completed Plays: ${stats.totalCompleted}`);
    console.log(`   Unique Songs: ${stats.uniqueSongs}`);
    console.log(`   Completion Rate: ${stats.completionRate}%`);
    console.log(`   Avg Play Duration: ${stats.avgDuration}s\n`);

    // 5. Song Analytics
    console.log('5️⃣  Song Analytics (Song 1):');
    const songAnalytics = await Analytics.getSongAnalytics(songs[0]._id, startDate, endDate);
    console.log(`   Total Records: ${songAnalytics.length}`);
    songAnalytics.slice(0, 3).forEach((day) => {
      console.log(`   ${day.date.toISOString().split('T')[0]}: ${day.plays} plays`);
    });
    console.log();

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await Analytics.deleteMany({ song: { $in: songs.map((s) => s._id) } });
    await Song.deleteMany({ _id: { $in: songs.map((s) => s._id) } });
    console.log('✅ Cleanup complete\n');

    console.log('✅ All tests passed!');
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testAnalytics();
