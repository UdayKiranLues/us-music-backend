import mongoose from "mongoose";
import User from "../src/models/User.js";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

await User.deleteMany({ role: "admin" });

// Create admin with plain text password - the User model's pre-save hook will hash it
await User.create({
  name: "Admin",
  username: "admin",
  email: "admin@usmusic.com",
  password: "admin123", // Plain text - will be hashed by pre-save hook
  role: "admin",
  roleSelected: true
});

console.log("Admin reset complete");