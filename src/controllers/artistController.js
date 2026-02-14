import User from '../models/User.js';
import ArtistProfile from '../models/ArtistProfile.js';
import { generateTokens } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import config from '../config/index.js';

// Artist registration (creates User with role 'artist' and ArtistProfile)
export const registerArtist = async (req, res, next) => {
  try {
    const { name, username, email, password, artistName, bio } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      return next(new AppError(`${field === 'email' ? 'User' : 'Username'} already exists`, 400));
    }

    const user = await User.create({ name, username, email, password, role: 'artist' });

    const profile = await ArtistProfile.create({ userId: user._id, artistName, bio });
    user.artistProfile = profile._id;
    await user.save();

    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(201).json({ success: true, data: { user: user.toJSON(), profile }, token: tokens.accessToken });
  } catch (err) {
    next(err);
  }
};

// Artist login - identical to normal login but ensures role set to artist
export const loginArtist = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const query = email
      ? { email: email.toLowerCase() }
      : { username: username.toLowerCase() };

    const user = await User.findOne(query).select('+password');
    if (!user) return next(new AppError('Invalid credentials', 401));

    const valid = await user.comparePassword(password);
    if (!valid) return next(new AppError('Invalid credentials', 401));

    // If user is not artist yet, assign role and create profile if requested
    if (user.role !== 'artist') {
      user.role = 'artist';
      await user.save();
    }

    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({ success: true, data: { user: user.toJSON() }, token: tokens.accessToken });
  } catch (err) {
    next(err);
  }
};

export const getArtistMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('artistProfile').lean();
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const updateArtistProfile = async (req, res, next) => {
  try {
    const user = req.user;
    let profile = null;
    if (user.artistProfile) {
      profile = await ArtistProfile.findByIdAndUpdate(user.artistProfile, req.body, { new: true });
    } else {
      profile = await ArtistProfile.create({ userId: user._id, ...req.body });
      user.artistProfile = profile._id;
      user.role = 'artist';
      await user.save();
    }

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

export const getArtistStats = async (req, res, next) => {
  try {
    const artistProfileId = req.user.artistProfile;
    if (!artistProfileId) {
      return next(new AppError('Artist profile not found', 404));
    }

    const mongoose = await import('mongoose');
    const Song = mongoose.default.model('Song');
    const Album = mongoose.default.model('Album');

    // Count songs
    const songCount = await Song.countDocuments({ createdByArtist: artistProfileId });

    // Count albums
    const albumCount = await Album.countDocuments({ artistProfile: artistProfileId });

    // Sum total plays across all songs
    const songStats = await Song.aggregate([
      { $match: { createdByArtist: artistProfileId } },
      { $group: { _id: null, totalPlays: { $sum: "$totalPlays" } } }
    ]);

    const totalPlays = songStats.length > 0 ? songStats[0].totalPlays : 0;

    res.json({
      success: true,
      data: {
        songs: songCount,
        albums: albumCount,
        totalPlays,
        followers: 0, // Placeholder
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getPublicArtistProfile = async (req, res, next) => {
  try {
    const profile = await ArtistProfile.findOne({ artistName: req.params.artistName });
    if (!profile) {
      return next(new AppError('Artist not found', 404));
    }

    const user = await User.findById(profile.userId).select('name username avatar');

    res.json({
      success: true,
      data: {
        ...profile.toObject(),
        name: user.name,
        username: user.username,
        avatar: user.avatar
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getArtistSongsPublic = async (req, res, next) => {
  try {
    const profile = await ArtistProfile.findOne({ artistName: req.params.artistName });
    if (!profile) {
      return next(new AppError('Artist not found', 404));
    }

    const mongoose = await import('mongoose');
    const Song = mongoose.default.model('Song');

    const songs = await Song.find({ createdByArtist: profile._id, status: 'published' })
      .sort('-createdAt')
      .lean();

    res.json({
      success: true,
      data: songs
    });
  } catch (err) {
    next(err);
  }
};

export const getArtistPodcastsPublic = async (req, res, next) => {
  try {
    const profile = await ArtistProfile.findOne({ artistName: req.params.artistName });
    if (!profile) {
      return next(new AppError('Artist not found', 404));
    }

    const mongoose = await import('mongoose');
    const Podcast = mongoose.default.model('Podcast');

    const podcasts = await Podcast.find({ artist: profile.userId })
      .sort('-createdAt')
      .lean();

    res.json({
      success: true,
      data: podcasts
    });
  } catch (err) {
    next(err);
  }
};

export default { registerArtist, loginArtist, getArtistMe, updateArtistProfile, getArtistStats, getPublicArtistProfile, getArtistSongsPublic, getArtistPodcastsPublic };
