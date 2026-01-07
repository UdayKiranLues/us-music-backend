import Song from '../models/Song.js';
import History from '../models/History.js';
import Favorite from '../models/Favorite.js';

/**
 * Smart recommendation engine based on user preferences and listening history
 */
class RecommendationService {
  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(userId, limit = 20) {
    // Get user's listening history
    const history = await History.find({ user: userId })
      .sort({ playedAt: -1 })
      .limit(100)
      .populate('song');

    // Get user's favorites
    const favorites = await Favorite.find({ user: userId }).populate('song');

    // Extract user preferences
    const userPreferences = this.extractPreferences(history, favorites);

    // Find similar songs
    const recommendations = await this.findSimilarSongs(userPreferences, userId, limit);

    return recommendations;
  }

  /**
   * Extract user preferences from history and favorites
   */
  extractPreferences(history, favorites) {
    const genreCount = {};
    const artistCount = {};
    const moodCount = {};
    const bpmSum = { total: 0, count: 0 };

    // Process history
    history.forEach((entry) => {
      if (!entry.song) return;

      const song = entry.song;
      genreCount[song.genre] = (genreCount[song.genre] || 0) + 1;
      artistCount[song.artist] = (artistCount[song.artist] || 0) + 1;

      if (song.metadata?.mood) {
        moodCount[song.metadata.mood] = (moodCount[song.metadata.mood] || 0) + 1;
      }

      if (song.metadata?.bpm) {
        bpmSum.total += song.metadata.bpm;
        bpmSum.count += 1;
      }
    });

    // Process favorites (weighted higher)
    favorites.forEach((fav) => {
      if (!fav.song) return;

      const song = fav.song;
      genreCount[song.genre] = (genreCount[song.genre] || 0) + 3;
      artistCount[song.artist] = (artistCount[song.artist] || 0) + 3;

      if (song.metadata?.mood) {
        moodCount[song.metadata.mood] = (moodCount[song.metadata.mood] || 0) + 3;
      }

      if (song.metadata?.bpm) {
        bpmSum.total += song.metadata.bpm * 3;
        bpmSum.count += 3;
      }
    });

    // Get top preferences
    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);

    const topArtists = Object.entries(artistCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);

    const topMoods = Object.entries(moodCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map((entry) => entry[0]);

    const avgBpm = bpmSum.count > 0 ? bpmSum.total / bpmSum.count : null;

    return {
      genres: topGenres,
      artists: topArtists,
      moods: topMoods,
      avgBpm,
    };
  }

  /**
   * Find similar songs based on preferences
   */
  async findSimilarSongs(preferences, userId, limit) {
    // Get recently played song IDs to exclude
    const recentHistory = await History.find({ user: userId })
      .sort({ playedAt: -1 })
      .limit(50)
      .select('song');

    const excludeSongIds = recentHistory.map((h) => h.song);

    // Build query
    const query = {
      _id: { $nin: excludeSongIds },
      isPublished: true,
    };

    // Match genres
    if (preferences.genres.length > 0) {
      query.genre = { $in: preferences.genres };
    }

    // Find candidate songs
    let candidateSongs = await Song.find(query).limit(limit * 3);

    // Score and sort songs
    candidateSongs = candidateSongs.map((song) => {
      let score = 0;

      // Genre match (40 points)
      if (preferences.genres.includes(song.genre)) {
        const genreIndex = preferences.genres.indexOf(song.genre);
        score += 40 - genreIndex * 10;
      }

      // Artist match (30 points)
      if (preferences.artists.includes(song.artist)) {
        const artistIndex = preferences.artists.indexOf(song.artist);
        score += 30 - artistIndex * 5;
      }

      // Mood match (20 points)
      if (song.metadata?.mood && preferences.moods.includes(song.metadata.mood)) {
        score += 20;
      }

      // BPM proximity (10 points)
      if (preferences.avgBpm && song.metadata?.bpm) {
        const bpmDiff = Math.abs(song.metadata.bpm - preferences.avgBpm);
        if (bpmDiff <= 10) score += 10;
        else if (bpmDiff <= 20) score += 7;
        else if (bpmDiff <= 30) score += 4;
      }

      // Popularity bonus
      score += Math.min(song.statistics.playCount / 1000, 10);

      return { song, score };
    });

    // Sort by score and return top results
    candidateSongs.sort((a, b) => b.score - a.score);

    return candidateSongs.slice(0, limit).map((item) => item.song);
  }

  /**
   * Get trending songs globally
   */
  async getTrendingSongs(limit = 20) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return await Song.find({
      isPublished: true,
      createdAt: { $gte: sevenDaysAgo },
    })
      .sort({ 'statistics.playCount': -1 })
      .limit(limit);
  }

  /**
   * Get similar songs to a specific song
   */
  async getSimilarSongs(songId, limit = 10) {
    const song = await Song.findById(songId);
    if (!song) return [];

    const similar = await Song.find({
      _id: { $ne: songId },
      isPublished: true,
      $or: [
        { genre: song.genre },
        { artist: song.artist },
        { 'metadata.mood': song.metadata?.mood },
      ],
    }).limit(limit * 2);

    // Score by similarity
    const scored = similar.map((s) => {
      let score = 0;
      if (s.genre === song.genre) score += 40;
      if (s.artist === song.artist) score += 30;
      if (s.metadata?.mood === song.metadata?.mood) score += 20;

      if (song.metadata?.bpm && s.metadata?.bpm) {
        const bpmDiff = Math.abs(s.metadata.bpm - song.metadata.bpm);
        if (bpmDiff <= 10) score += 10;
        else if (bpmDiff <= 20) score += 5;
      }

      return { song: s, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.song);
  }

  /**
   * Get next song recommendation based on current song
   * Uses weighted scoring algorithm for optimal selection
   * 
   * @param {string} currentSongId - Currently playing song ID
   * @param {string} userId - User ID (optional, for history)
   * @returns {Object|null} Next recommended song or null
   */
  async getNextSong(currentSongId, userId = null) {
    // Get current song
    const currentSong = await Song.findById(currentSongId).lean();
    if (!currentSong) return null;

    // Get recently played songs to avoid repetition
    let recentlyPlayedIds = [currentSongId];
    if (userId) {
      const recentHistory = await History.find({ user: userId })
        .sort({ playedAt: -1 })
        .limit(20)
        .select('song')
        .lean();
      
      recentlyPlayedIds = [...recentlyPlayedIds, ...recentHistory.map(h => h.song.toString())];
    }

    // Find candidate songs (exclude recently played)
    const candidates = await Song.find({
      _id: { $nin: recentlyPlayedIds },
    })
      .select('title artist genre mood bpm language popularity')
      .limit(100) // Limit for performance
      .lean();

    if (candidates.length === 0) {
      // Fallback to popular songs if no candidates
      return await Song.findOne({
        _id: { $ne: currentSongId },
      })
        .sort({ popularity: -1 })
        .lean();
    }

    // Score each candidate song
    const scoredCandidates = candidates.map(song => {
      let score = 0;

      // 1. Genre match (30 points max)
      const genreMatches = song.genre.filter(g => currentSong.genre.includes(g));
      score += genreMatches.length * 15; // 15 points per matching genre

      // 2. Mood match (25 points max)
      if (song.mood && currentSong.mood) {
        const moodMatches = song.mood.filter(m => currentSong.mood.includes(m));
        score += moodMatches.length * 12.5; // 12.5 points per matching mood
      }

      // 3. BPM similarity (20 points max)
      if (song.bpm && currentSong.bpm) {
        const bpmDiff = Math.abs(song.bpm - currentSong.bpm);
        if (bpmDiff <= 10) {
          score += 20; // Perfect range
        } else if (bpmDiff <= 20) {
          score += 10; // Acceptable range
        } else if (bpmDiff <= 30) {
          score += 5; // Marginal range
        }
        // 0 points if BPM diff > 30
      }

      // 4. Same artist (15 points)
      if (song.artist === currentSong.artist) {
        score += 15;
      }

      // 5. Language match (10 points)
      if (song.language === currentSong.language) {
        score += 10;
      }

      // 6. Popularity bonus (max 10 points)
      // Scale popularity (0-100) to 0-10 points
      score += (song.popularity / 10);

      return { song, score };
    });

    // Sort by score (descending) and get the best match
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Return the highest scoring song
    return scoredCandidates[0]?.song || null;
  }
}

export default new RecommendationService();
