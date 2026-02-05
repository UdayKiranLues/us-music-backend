import mongoose from 'mongoose';
import Song from './src/models/Song.js';
import connectDB from './src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const findSong = async () => {
    try {
        await connectDB();
        const song = await Song.findOne({ title: /Borrowed Time/i });
        if (song) {
            console.log('✅ Found Song:', song.title);
            console.log('ID:', song._id);
            console.log('Cover URL:', song.coverImageUrl);
            console.log('HLS URL:', song.hlsUrl);
        } else {
            console.log('❌ Song "Borrowed Time" not found.');

            // List all songs to see what we have
            const songs = await Song.find({}).limit(5);
            console.log('\nAvailable songs:', songs.map(s => s.title));
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

findSong();
