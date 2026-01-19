import Joi from 'joi';
import { AppError } from '../utils/errors.js';

/**
 * Validate request data against Joi schema
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      return next(new AppError(errorMessage, 400));
    }

    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // Auth
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),

  login: Joi.object({
    email: Joi.string().email(),
    username: Joi.string().min(2).max(100),
    password: Joi.string().required(),
  }).or('email', 'username'),

  chooseRole: Joi.object({
    role: Joi.string().valid('user', 'artist').required(),
  }),

  changeUsername: Joi.object({
    newUsername: Joi.string().min(2).max(100).pattern(/^[a-z0-9_]+$/).required(),
  }),

  // User
  updateProfile: Joi.object({
    displayName: Joi.string().max(100),
    bio: Joi.string().max(500),
  }),

  updatePreferences: Joi.object({
    favoriteGenres: Joi.array().items(Joi.string()),
    language: Joi.string(),
    explicitContent: Joi.boolean(),
  }),

  // Song
  createSong: Joi.object({
    title: Joi.string().max(200).required(),
    artist: Joi.string().required(),
    album: Joi.string(),
    genre: Joi.string()
      .valid(
        'Pop',
        'Rock',
        'Hip-Hop',
        'Electronic',
        'Jazz',
        'Classical',
        'Country',
        'R&B',
        'Latin',
        'Indie',
        'Metal',
        'Blues',
        'Folk',
        'Reggae',
        'Soul',
        'Other'
      )
      .required(),
    duration: Joi.number().positive().required(),
    audioUrl: Joi.string().uri().required(),
    coverUrl: Joi.string().uri().required(),
    metadata: Joi.object({
      bpm: Joi.number().positive(),
      key: Joi.string(),
      mood: Joi.string().valid('energetic', 'happy', 'sad', 'calm', 'intense', 'romantic'),
      language: Joi.string(),
      explicit: Joi.boolean(),
    }),
    tags: Joi.array().items(Joi.string()),
    releaseDate: Joi.date(),
  }),

  updateSong: Joi.object({
    title: Joi.string().max(200),
    artist: Joi.string(),
    album: Joi.string(),
    genre: Joi.string().valid(
      'Pop',
      'Rock',
      'Hip-Hop',
      'Electronic',
      'Jazz',
      'Classical',
      'Country',
      'R&B',
      'Latin',
      'Indie',
      'Metal',
      'Blues',
      'Folk',
      'Reggae',
      'Soul',
      'Other'
    ),
    coverUrl: Joi.string().uri(),
    metadata: Joi.object({
      bpm: Joi.number().positive(),
      key: Joi.string(),
      mood: Joi.string().valid('energetic', 'happy', 'sad', 'calm', 'intense', 'romantic'),
      language: Joi.string(),
      explicit: Joi.boolean(),
    }),
    tags: Joi.array().items(Joi.string()),
    isPublished: Joi.boolean(),
  }),

  // History
  addHistory: Joi.object({
    songId: Joi.string().required(),
    playDuration: Joi.number().min(0),
    completed: Joi.boolean(),
    source: Joi.string().valid('search', 'recommendation', 'playlist', 'album', 'artist', 'direct'),
  }),

  // Favorites
  checkMultipleFavorites: Joi.object({
    songIds: Joi.array().items(Joi.string()).min(1).max(100).required(),
  }),
};
