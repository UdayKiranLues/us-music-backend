# Analytics API Documentation

## Overview
Comprehensive analytics system for tracking song plays, user engagement, and platform metrics.

## Features
- ✅ Real-time play tracking
- ✅ Unique listeners per song
- ✅ Daily plays aggregation
- ✅ Top songs/albums analytics
- ✅ Genre-wise statistics
- ✅ Optimized MongoDB queries with indexes

## Data Models

### Analytics Schema
```javascript
{
  song: ObjectId,           // Reference to Song
  album: String,            // Album name
  date: Date,               // Aggregation date (one doc per song per day)
  plays: Number,            // Total plays
  uniqueListeners: Set,     // Unique user IDs
  completedPlays: Number,   // Plays that reached >80% duration
  totalDuration: Number,    // Total seconds played
  sources: {
    search: Number,
    recommendation: Number,
    playlist: Number,
    album: Number,
    artist: Number,
    direct: Number
  }
}
```

### Song Model Updates
```javascript
{
  // Existing fields...
  album: String,
  totalPlays: Number,       // Quick access play count
  uniqueListeners: Number,  // Cached unique listener count
  lastPlayedAt: Date        // Last play timestamp
}
```

## API Endpoints

### 1. Record Play Event
**POST** `/api/v1/analytics/play`

Called by frontend when a song is played.

**Request:**
```json
{
  "songId": "60d5ec49f1b2c8b9e8c8a1b2",
  "playDuration": 180,
  "completed": true,
  "source": "recommendation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Play event recorded"
}
```

---

### 2. Get Analytics Dashboard
**GET** `/api/v1/analytics/dashboard?days=30`

**Admin Only** - Comprehensive dashboard data.

**Query Parameters:**
- `days` - Number of days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-30",
      "days": 30
    },
    "overallStats": {
      "totalPlays": 458923,
      "totalCompleted": 325642,
      "totalDuration": 82345678,
      "uniqueSongs": 1847,
      "completionRate": 70.98,
      "avgDuration": 179.54
    },
    "topSongs": [...],
    "topAlbums": [...],
    "dailyTrend": [...]
  }
}
```

---

### 3. Get Song Analytics
**GET** `/api/v1/analytics/songs/:songId?startDate=2024-01-01&endDate=2024-01-30`

**Admin Only** - Detailed analytics for a specific song.

**Query Parameters:**
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "song": {
      "id": "60d5ec49f1b2c8b9e8c8a1b2",
      "title": "Sunset Dreams",
      "artist": "Luna Wave",
      "album": "Summer Vibes",
      "totalPlays": 15234,
      "uniqueListeners": 8542
    },
    "dailyStats": [
      {
        "date": "2024-01-01",
        "plays": 456,
        "uniqueListeners": 234,
        "completedPlays": 325
      }
    ]
  }
}
```

---

### 4. Get Top Songs
**GET** `/api/v1/analytics/songs/top?limit=10&startDate=2024-01-01&endDate=2024-01-30`

**Admin Only** - Most played songs.

**Query Parameters:**
- `limit` - Number of songs (default: 10)
- `startDate` - Optional start date
- `endDate` - Optional end date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "songId": "60d5ec49f1b2c8b9e8c8a1b2",
      "title": "Sunset Dreams",
      "artist": "Luna Wave",
      "coverImageUrl": "https://...",
      "totalPlays": 15234,
      "totalUniqueListeners": 8542,
      "totalCompleted": 10876,
      "avgDailyPlays": 507.8,
      "completionRate": 71.4
    }
  ]
}
```

---

### 5. Get Top Albums
**GET** `/api/v1/analytics/albums/top?limit=10`

**Admin Only** - Most played albums.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "album": "Summer Vibes 2024",
      "totalPlays": 45678,
      "totalUniqueListeners": 15234,
      "songCount": 12
    }
  ]
}
```

---

### 6. Get Daily Trend
**GET** `/api/v1/analytics/trend/daily?startDate=2024-01-01&endDate=2024-01-30`

**Admin Only** - Daily plays over time.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-01",
      "totalPlays": 12400,
      "uniqueListeners": 890,
      "completedPlays": 8856
    }
  ]
}
```

---

### 7. Get Overall Stats
**GET** `/api/v1/analytics/stats?startDate=2024-01-01&endDate=2024-01-30`

**Admin Only** - Platform-wide statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPlays": 458923,
    "totalCompleted": 325642,
    "totalDuration": 82345678,
    "uniqueSongs": 1847,
    "totalSongs": 2100,
    "completionRate": 70.98,
    "avgDuration": 179.54
  }
}
```

---

### 8. Get Genre Analytics
**GET** `/api/v1/analytics/genres?startDate=2024-01-01&endDate=2024-01-30`

**Admin Only** - Genre-wise breakdown.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "genre": "Pop",
      "totalPlays": 160623,
      "uniqueListeners": 12543,
      "songCount": 642
    },
    {
      "genre": "Electronic",
      "totalPlays": 128498,
      "uniqueListeners": 9876,
      "songCount": 518
    }
  ]
}
```

---

## Database Indexes

### Analytics Collection
```javascript
{ song: 1, date: 1 }          // Unique index (one doc per song per day)
{ date: -1, plays: -1 }       // Top songs by date
{ album: 1, date: -1 }        // Album analytics
{ song: 1, date: -1 }         // Song history
```

### Song Collection
```javascript
{ totalPlays: -1 }            // Most played songs
{ album: 1, totalPlays: -1 }  // Album songs by plays
{ lastPlayedAt: -1 }          // Recently played
```

## Performance Optimizations

### 1. Upsert Strategy
One document per song per day reduces document count:
```javascript
// Instead of creating a new doc for each play:
// ❌ 1M plays = 1M documents

// We aggregate daily:
// ✅ 1M plays = ~33K documents (1847 songs × 30 days)
```

### 2. Cached Counters
```javascript
// Song model stores frequently accessed metrics
song.totalPlays         // Updated on each play
song.uniqueListeners    // Updated async (every 100 plays)
song.lastPlayedAt       // Updated on each play
```

### 3. Aggregation Pipeline
Efficient MongoDB aggregations with:
- `$match` - Filter by date range
- `$group` - Aggregate by song/album
- `$lookup` - Join with songs collection
- `$sort` - Order by plays
- `$limit` - Top N results

### 4. Background Updates
```javascript
// Non-blocking analytics updates
recordPlayEvent().catch(err => logger.error(err));
// User request continues without waiting
```

## Usage Examples

### Frontend Integration

#### 1. Track Play (Music Player)
```javascript
// When song starts playing
const trackPlay = async (songId) => {
  const startTime = Date.now();
  
  // When song ends or user stops
  const onPlayEnd = async () => {
    const playDuration = Math.floor((Date.now() - startTime) / 1000);
    const completed = playDuration > song.duration * 0.8;
    
    await fetch('/api/v1/analytics/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songId,
        playDuration,
        completed,
        source: 'playlist' // or 'search', 'recommendation', etc.
      })
    });
  };
};
```

#### 2. Admin Dashboard (Fetch Analytics)
```javascript
// Get dashboard data
const getDashboard = async () => {
  const response = await fetch('/api/v1/analytics/dashboard?days=30');
  const data = await response.json();
  
  // Use data.overallStats, data.topSongs, etc.
};

// Get top songs
const getTopSongs = async () => {
  const response = await fetch('/api/v1/analytics/songs/top?limit=10');
  const { data } = await response.json();
  
  data.forEach(song => {
    console.log(`${song.title} - ${song.totalPlays} plays`);
  });
};
```

## Monitoring

### Log Analytics Events
```javascript
logger.s3('Play event recorded', { songId, userId });
logger.error('Failed to record analytics', { error, songId });
```

### Check Data Integrity
```bash
# MongoDB shell - Check analytics collection
db.analytics.countDocuments()
db.analytics.aggregate([
  { $group: { _id: null, totalPlays: { $sum: "$plays" } } }
])

# Compare with song counters
db.songs.aggregate([
  { $group: { _id: null, totalPlays: { $sum: "$totalPlays" } } }
])
```

## Scalability Considerations

### 1. Data Retention
- Keep detailed daily analytics for 90 days
- Aggregate to monthly after 90 days
- Keep monthly aggregates indefinitely

### 2. Sharding Strategy (Future)
```javascript
// Shard by date for write distribution
sh.shardCollection("usmusic.analytics", { date: 1, song: 1 })
```

### 3. Read Replicas
- Route analytics queries to read replicas
- Keep writes on primary

### 4. Caching
- Cache top songs/albums (TTL: 5 minutes)
- Cache genre stats (TTL: 15 minutes)
- Cache daily trends (TTL: 1 hour)

## Testing

### Test Play Recording
```bash
# Record a play
curl -X POST http://localhost:5000/api/v1/analytics/play \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "songId": "SONG_ID",
    "playDuration": 180,
    "completed": true,
    "source": "direct"
  }'
```

### Test Analytics Retrieval
```bash
# Get top songs
curl http://localhost:5000/api/v1/analytics/songs/top?limit=5 \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Get dashboard
curl http://localhost:5000/api/v1/analytics/dashboard?days=7 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Summary

✅ **Implemented:**
- Analytics model with daily aggregation
- Song model with cached play counts
- 8 analytics endpoints
- Efficient MongoDB indexes
- Automatic play tracking
- Admin-only analytics access
- Genre and album analytics
- Daily trend analysis

✅ **Performance:**
- Upsert strategy reduces documents by 30x
- Cached counters for instant access
- Optimized aggregation pipelines
- Background updates (non-blocking)

✅ **Scalable:**
- Ready for millions of plays
- Efficient queries with proper indexes
- Designed for future sharding
- Data retention strategy included

🎯 **Next Steps:**
1. Add caching layer (Redis)
2. Implement data retention policies
3. Add export functionality
4. Create scheduled jobs for aggregations
5. Add real-time WebSocket updates
