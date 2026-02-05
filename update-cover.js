import mongoose from 'mongoose';
import Song from './src/models/Song.js';
import connectDB from './src/config/database.js';
import { uploadFile } from './src/utils/storage.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const SOURCE_IMAGE = String.raw`C:\Users\user\Downloads\Borrowed-time.png`; // Raw string for Windows path

const updateCover = async () => {
    try {
        console.log('🔌 Connecting to DB...');
        await connectDB();

        console.log('🔍 Finding song "Borrowed Time"...');
        const song = await Song.findOne({ title: /Borrowed Time/i });

        if (!song) {
            console.error('❌ Song "Borrowed Time" not found.');
            process.exit(1);
        }

        console.log('✅ Found Song:', song.title, `(${song._id})`);
        console.log('   Current Cover:', song.coverImageUrl);

        // Check if source file exists
        if (!fs.existsSync(SOURCE_IMAGE)) {
            console.error(`❌ Source image not found at: ${SOURCE_IMAGE}`);
            // Fallback to checking if it's in the current dir just in case
            if (fs.existsSync('Borrowed-time.png')) {
                console.log('⚠️ Found in current directory instead');
                // Update source logic if needed, but sticking to user request first
            }
            process.exit(1);
        }

        console.log('🖼️ Uploading new cover image...');

        // Read file buffer? Or copy?
        // storage.uploadFile handles copy if path is string and local mode.
        // We'll pass the path directly.

        const ext = path.extname(SOURCE_IMAGE);
        const key = `songs/${song._id}/cover${ext}`;

        // Force copy by passing path
        const newUrl = await uploadFile(SOURCE_IMAGE, key, 'image/png');

        console.log('✅ Uploaded to:', newUrl);

        // Update DB
        song.coverImageUrl = newUrl;
        await song.save();

        console.log('✅ Database updated successfully!');
        console.log('   New Cover URL:', song.coverImageUrl);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

updateCover();
