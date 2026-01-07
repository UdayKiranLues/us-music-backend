# MongoDB Mongoose Schemas Documentation

## ✅ Schemas Created

### User Schema

```javascript
{
  name: String (required, 2-100 chars)
  email: String (required, unique, indexed)
  password: String (required, hashed with bcrypt, min 8 chars)
  favourites: [Song ObjectIds]
  playHistory: [{
    song: Song ObjectId,
    playedAt: Date
  }]
  timestamps: { createdAt, updatedAt }
}
```

**Indexes:**
- `email`: Unique index for fast lookups and authentication
- `playHistory.playedAt`: Descending index for recent history queries
- `favourites`: Index for favorite song lookups

**Features:**
- Password auto-hashing on save (bcrypt, 12 rounds)
- `comparePassword()` method for authentication
- Password excluded from JSON responses
- Refresh token storage for JWT

---

### Song Schema

```javascript
{
  title: String (required, max 200 chars, indexed)
  artist: String (required, indexed)
  genre: [String] (array, required, indexed)
  mood: [String] (array, indexed)
  bpm: Number (0-300)
  language: String (required, indexed)
  popularity: Number (0-100, default: 0, indexed desc)
  duration: Number (seconds, required)
  coverImageUrl: String (required)
  hlsUrl: String (required, must end with .m3u8)
  timestamps: { createdAt, updatedAt }
}
```

**Indexes:**
- Text index: `{title, artist}` - Full-text search
- Compound: `{genre, popularity}` - Filter by genre, sort by popularity
- Compound: `{mood, popularity}` - Mood-based recommendations
- Compound: `{language, popularity}` - Language filtering
- Single: `{createdAt}` - Sort by newest
- Compound: `{popularity, createdAt}` - Popular and recent
- Single: `{bpm}` - Tempo-based filtering

**Features:**
- HLS (m3u8) validation for streaming
- Virtual field `formattedDuration` (MM:SS format)
- Genre and mood as arrays for multi-tagging
- Popularity scoring (0-100)

---

## 🔍 Query Examples

### User Queries

```javascript
// Find user with favourites
await User.findById(userId).populate('favourites');

// Get user's play history (recent first)
await User.findById(userId)
  .populate({
    path: 'playHistory.song',
    select: 'title artist coverImageUrl duration'
  })
  .sort({ 'playHistory.playedAt': -1 });

// Add song to favourites
await User.findByIdAndUpdate(
  userId,
  { $addToSet: { favourites: songId } }
);

// Add to play history
await User.findByIdAndUpdate(
  userId,
  {
    $push: {
      playHistory: {
        $each: [{ song: songId, playedAt: new Date() }],
        $position: 0,
        $slice: 100 // Keep only last 100 plays
      }
    }
  }
);
```

### Song Queries

```javascript
// Full-text search
await Song.find({
  $text: { $search: 'summer sunset' }
});

// Filter by genre and sort by popularity
await Song.find({ genre: { $in: ['Pop', 'Dance'] } })
  .sort({ popularity: -1 })
  .limit(20);

// Mood-based recommendations
await Song.find({ mood: { $in: ['happy', 'energetic'] } })
  .sort({ popularity: -1 });

// BPM range query
await Song.find({ bpm: { $gte: 120, $lte: 140 } });

// Language filtering
await Song.find({ language: 'English' })
  .sort({ createdAt: -1 });

// Get popular recent songs
await Song.find()
  .sort({ popularity: -1, createdAt: -1 })
  .limit(50);
```

---

## 📊 Scalability Features

### Indexing Strategy
- **Unique indexes** on frequently queried unique fields (email)
- **Compound indexes** for common query patterns (genre + popularity)
- **Text indexes** for search functionality
- **Single field indexes** for filtering and sorting

### Performance Optimizations
1. **Selective Population**: Only populate required fields
2. **Pagination**: Use `skip()` and `limit()` with proper indexes
3. **Projection**: Select only needed fields with `.select()`
4. **Lean Queries**: Use `.lean()` for read-only operations
5. **Index Usage**: Ensure queries use proper indexes with `.explain()`

### Best Practices
```javascript
// Good: Uses indexes, pagination, projection
await Song.find({ genre: 'Pop' })
  .select('title artist coverImageUrl duration')
  .sort({ popularity: -1 })
  .skip(page * limit)
  .limit(limit)
  .lean();

// Good: Batch operations
await User.updateMany(
  { _id: { $in: userIds } },
  { $addToSet: { favourites: songId } }
);

// Good: Aggregation for analytics
await User.aggregate([
  { $unwind: '$playHistory' },
  { $group: {
      _id: '$playHistory.song',
      playCount: { $sum: 1 }
    }
  },
  { $sort: { playCount: -1 } },
  { $limit: 10 }
]);
```

---

## 🚀 API Integration Examples

### Register User with Initial Data

```javascript
POST /api/v1/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

### Add Song

```javascript
POST /api/v1/songs
{
  "title": "Summer Vibes",
  "artist": "DJ Sunset",
  "genre": ["Electronic", "House"],
  "mood": ["energetic", "happy"],
  "bpm": 128,
  "language": "English",
  "duration": 195,
  "coverImageUrl": "https://example.com/cover.jpg",
  "hlsUrl": "https://example.com/audio/playlist.m3u8"
}
```

### Add to Favourites

```javascript
POST /api/v1/users/favourites/:songId
// Adds song to user's favourites array
```

### Track Play History

```javascript
POST /api/v1/users/history
{
  "songId": "65abc123..."
}
// Adds song to user's playHistory with timestamp
```

### Get Recommendations

```javascript
GET /api/v1/songs/recommended
// Based on user's favourites and playHistory
// Filters by similar genres, moods, and language
```

---

## 🎯 Sample Data

Run the seed script to populate your database:

```bash
npm run seed
```

This creates:
- **3 users** with sample favourites and play history
- **10 songs** across various genres and moods
- Sample credentials: `john@example.com` / `Password123!`

---

## 📈 Monitoring Indexes

```javascript
// Check indexes
await User.collection.getIndexes();
await Song.collection.getIndexes();

// Explain query performance
await Song.find({ genre: 'Pop' })
  .sort({ popularity: -1 })
  .explain('executionStats');
```

---

## 🔧 Schema Modifications

To modify schemas:
1. Update model files
2. For index changes, drop old indexes first:
   ```javascript
   await Song.collection.dropIndexes();
   await Song.syncIndexes();
   ```
3. Test with sample queries
4. Re-seed database if needed

---

## ✅ Production Ready

Both schemas are optimized for:
- ✅ Fast queries with proper indexing
- ✅ Scalability with compound indexes
- ✅ Security with password hashing
- ✅ Data integrity with validation
- ✅ HLS streaming support
- ✅ Multi-genre/mood tagging
- ✅ Play history tracking
- ✅ Recommendation algorithms
