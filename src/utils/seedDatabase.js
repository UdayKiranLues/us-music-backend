import mongoose from 'mongoose';
import User from '../models/User.js';
import Song from '../models/Song.js';
import connectDB from '../config/database.js';

const sampleSongs = [
  {
    title: 'Summer Vibes',
    artist: 'DJ Sunset',
    genre: ['Electronic', 'House', 'Dance'],
    mood: ['energetic', 'happy', 'uplifting'],
    bpm: 128,
    language: 'English',
    popularity: 85,
    duration: 195,
    coverImageUrl: 'https://example.com/covers/summer-vibes.jpg',
    hlsUrl: 'https://example.com/audio/summer-vibes/playlist.m3u8',
  },
  {
    title: 'Midnight Jazz',
    artist: 'The Blue Notes',
    genre: ['Jazz', 'Blues'],
    mood: ['calm', 'romantic', 'mellow'],
    bpm: 90,
    language: 'English',
    popularity: 72,
    duration: 245,
    coverImageUrl: 'https://example.com/covers/midnight-jazz.jpg',
    hlsUrl: 'https://example.com/audio/midnight-jazz/playlist.m3u8',
  },
  {
    title: 'Heartbreak Anthem',
    artist: 'Sarah Collins',
    genre: ['Pop', 'R&B'],
    mood: ['sad', 'emotional', 'melancholic'],
    bpm: 75,
    language: 'English',
    popularity: 95,
    duration: 218,
    coverImageUrl: 'https://example.com/covers/heartbreak-anthem.jpg',
    hlsUrl: 'https://example.com/audio/heartbreak-anthem/playlist.m3u8',
  },
  {
    title: 'Electric Dreams',
    artist: 'Neon City',
    genre: ['Electronic', 'Synthwave', 'Retrowave'],
    mood: ['energetic', 'nostalgic', 'dreamy'],
    bpm: 120,
    language: 'Instrumental',
    popularity: 78,
    duration: 203,
    coverImageUrl: 'https://example.com/covers/electric-dreams.jpg',
    hlsUrl: 'https://example.com/audio/electric-dreams/playlist.m3u8',
  },
  {
    title: 'Acoustic Sunrise',
    artist: 'Mountain Folk',
    genre: ['Folk', 'Acoustic', 'Indie'],
    mood: ['calm', 'peaceful', 'reflective'],
    bpm: 95,
    language: 'English',
    popularity: 68,
    duration: 187,
    coverImageUrl: 'https://example.com/covers/acoustic-sunrise.jpg',
    hlsUrl: 'https://example.com/audio/acoustic-sunrise/playlist.m3u8',
  },
  {
    title: 'Hip Hop Hustle',
    artist: 'MC Flow',
    genre: ['Hip-Hop', 'Rap', 'Urban'],
    mood: ['energetic', 'confident', 'intense'],
    bpm: 140,
    language: 'English',
    popularity: 91,
    duration: 176,
    coverImageUrl: 'https://example.com/covers/hip-hop-hustle.jpg',
    hlsUrl: 'https://example.com/audio/hip-hop-hustle/playlist.m3u8',
  },
  {
    title: 'Classical Symphony',
    artist: 'Royal Orchestra',
    genre: ['Classical', 'Symphony'],
    mood: ['dramatic', 'elegant', 'sophisticated'],
    bpm: 60,
    language: 'Instrumental',
    popularity: 55,
    duration: 420,
    coverImageUrl: 'https://example.com/covers/classical-symphony.jpg',
    hlsUrl: 'https://example.com/audio/classical-symphony/playlist.m3u8',
  },
  {
    title: 'Rock Revolution',
    artist: 'Thunder Strike',
    genre: ['Rock', 'Hard Rock', 'Alternative'],
    mood: ['intense', 'rebellious', 'powerful'],
    bpm: 135,
    language: 'English',
    popularity: 82,
    duration: 234,
    coverImageUrl: 'https://example.com/covers/rock-revolution.jpg',
    hlsUrl: 'https://example.com/audio/rock-revolution/playlist.m3u8',
  },
  {
    title: 'Latin Passion',
    artist: 'Los Ritmos',
    genre: ['Latin', 'Salsa', 'World'],
    mood: ['energetic', 'passionate', 'festive'],
    bpm: 110,
    language: 'Spanish',
    popularity: 76,
    duration: 198,
    coverImageUrl: 'https://example.com/covers/latin-passion.jpg',
    hlsUrl: 'https://example.com/audio/latin-passion/playlist.m3u8',
  },
  {
    title: 'Lo-Fi Study',
    artist: 'Chill Beats',
    genre: ['Lo-Fi', 'Hip-Hop', 'Ambient'],
    mood: ['calm', 'focused', 'relaxed'],
    bpm: 85,
    language: 'Instrumental',
    popularity: 89,
    duration: 156,
    coverImageUrl: 'https://example.com/covers/lofi-study.jpg',
    hlsUrl: 'https://example.com/audio/lofi-study/playlist.m3u8',
  },
];

const sampleUsers = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password123!',
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'Password123!',
  },
  {
    name: 'Mike Johnson',
    email: 'mike@example.com',
    password: 'Password123!',
  },
];

const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();

    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Song.deleteMany({});

    console.log('🎵 Creating songs...');
    const createdSongs = await Song.insertMany(sampleSongs);
    console.log(`✅ Created ${createdSongs.length} songs`);

    console.log('👤 Creating users...');
    const createdUsers = [];
    
    for (let i = 0; i < sampleUsers.length; i++) {
      const userData = sampleUsers[i];
      const user = new User(userData);
      
      // Add favourites
      const favouriteIndices = [0, 2, 5];
      user.favourites = favouriteIndices.map(idx => createdSongs[idx]._id);
      
      // Add play history
      const historyIndices = [0, 1, 2, 5, 8];
      user.playHistory = historyIndices.map((idx, position) => ({
        song: createdSongs[idx]._id,
        playedAt: new Date(Date.now() - (historyIndices.length - position) * 3600000), // Stagger by hours
      }));
      
      await user.save();
      createdUsers.push(user);
    }
    
    console.log(`✅ Created ${createdUsers.length} users`);

    console.log('\n📊 Database seeded successfully!');
    console.log('\n📋 Sample Credentials:');
    console.log('Email: john@example.com');
    console.log('Password: Password123!');
    console.log('\n🎉 You can now test the API!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export default seedDatabase;
