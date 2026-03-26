import connectDB from './src/config/database.js';
import Song from './src/models/Song.js';
import mongoose from 'mongoose';

const fixDb = async () => {
  try {
    await connectDB();
    const res = await Song.updateMany(
      { coverImageUrl: 'https://via.placeholder.com/300' },
      { $set: { coverImageUrl: 'https://placehold.co/300' } }
    );
    console.log(`✅ Updated ${res.modifiedCount} songs in the database.`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
  }
};

fixDb();
