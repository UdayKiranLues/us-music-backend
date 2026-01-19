import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    // ❌ DO NOT USE unique:true here (causes index corruption)
    username: {
      type: String,
      required: [true, "Username is required"],
      lowercase: true,
      trim: true,
      minlength: [2, "Username must be at least 2 characters"],
      maxlength: [100, "Username cannot exceed 100 characters"],
    },

    // ❌ DO NOT USE unique:true here
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "artist", "admin"],
      default: "user",
    },

    roleSelected: {
      type: Boolean,
      default: false,
    },

    usernameChanged: {
      type: Boolean,
      default: false,
    },

    artistProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ArtistProfile",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    favourites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],

    playHistory: [
      {
        song: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song",
          required: true,
        },
        playedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    refreshToken: String,
  },
  {
    timestamps: true,
  }
);


// ===============================
// INDEXES (SINGLE SOURCE OF TRUTH)
// ===============================

// ✅ ONLY define unique indexes here
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

// Performance indexes
userSchema.index({ "playHistory.playedAt": -1 });
userSchema.index({ favourites: 1 });


// ===============================
// PASSWORD HASHING
// ===============================

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});


// ===============================
// PASSWORD COMPARISON
// ===============================

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};


// ===============================
// CLEAN JSON OUTPUT
// ===============================

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.refreshToken;
  delete user.__v;
  return user;
};

const User = mongoose.model("User", userSchema);

export default User;
