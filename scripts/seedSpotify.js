import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Song from '../src/models/Song.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const seedSongs = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('Missing MONGODB_URI in .env file');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        const dataPath = path.resolve(__dirname, 'spotifyData.json');
        
        if (!fs.existsSync(dataPath)) {
            console.error('Could not find spotifyData.json inside the scripts folder.');
            console.error('Please paste your Spotify API JSON into scripts/spotifyData.json');
            process.exit(1);
        }

        const rawData = fs.readFileSync(dataPath, 'utf-8');
        
        let spotifyData;
        try {
            spotifyData = JSON.parse(rawData);
        } catch (e) {
            console.error('Invalid JSON format in spotifyData.json');
            process.exit(1);
        }

        // Try to locate the tracks array within the potentially complex JSON structure
        let rawTracks = [];
        if (spotifyData.tracks && spotifyData.tracks.items) {
            rawTracks = spotifyData.tracks.items;
        } else if (spotifyData.items && spotifyData.items.items) {
             rawTracks = spotifyData.items.items;
        } else if (spotifyData.items) {
             rawTracks = spotifyData.items;
        } else if (Array.isArray(spotifyData)) {
            rawTracks = spotifyData;
        } else {
            console.error('Could not find a valid tracks array in spotifyData.json');
            process.exit(1);
        }

        const songsToInsert = [];

        for (const item of rawTracks) {
            const track = item.track || item; // Some responses wrap the track in an "item" object
            
            if (!track || !track.name) continue;

            const coverImage = track.album?.images?.[0]?.url || 'https://via.placeholder.com/300';
            const artist = track.artists?.[0]?.name || 'Unknown Artist';
            const duration = Math.max(1, Math.floor((track.duration_ms || 30000) / 1000));
            
            // HLS URL must end in .m3u8 to pass Mongoose validation. We append ?ext=.m3u8 
            // If there's no preview url provided, we use a fallback HLS stream dummy
            const hlsUrl = track.preview_url 
                ? `${track.preview_url}?ext=.m3u8` 
                : 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

            songsToInsert.push({
                title: track.name,
                artist: artist,
                genre: ['Pop'], // default genre since Spotify track object usually lacks genre
                language: 'English', // default language
                duration: duration,
                coverImageUrl: coverImage,
                hlsUrl: hlsUrl,
                status: 'published',
                popularity: track.popularity || 0,
                album: track.album?.name || 'Single',
            });
        }

        if (songsToInsert.length === 0) {
            console.log('No valid tracks found to insert.');
            process.exit(1);
        }

        console.log(`Prepared ${songsToInsert.length} songs for insertion. Checking for duplicates...`);

        // Insert individually so we can safely ignore duplicate errors or missing fields if any occur unexpectedly
        let inserted = 0;
        let failed = 0;

        for (const songData of songsToInsert) {
            try {
                // Check if this song already exists to prevent duplicate seeding
                const existing = await Song.findOne({ title: songData.title, artist: songData.artist });
                if (!existing) {
                    await Song.create(songData);
                    inserted++;
                } else {
                    console.log(`Skipping duplicate: ${songData.title} by ${songData.artist}`);
                }
            } catch (err) {
                console.error(`Failed to insert ${songData.title}:`, err.message);
                failed++;
            }
        }

        console.log(`\nSeeding complete! Successfully inserted ${inserted} new songs. (${failed} failed)`);
        process.exit(0);
    } catch (error) {
        console.error('An error occurred during seeding:', error);
        process.exit(1);
    }
};

seedSongs();
