const mongoose = require("mongoose");

async function cleanupStaleUserIndexes() {
  try {
    const User = require("../models/User");
    const indexes = await User.collection.indexes();

    for (const index of indexes) {
      if (index.key?.username) {
        await User.collection.dropIndex(index.name);
        console.log(`[db] Dropped stale username index: ${index.name}`);
      }
    }

    await User.syncIndexes();
  } catch (err) {
    console.warn("[db] Could not clean up user indexes:", err.message);
  }
}

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.warn("[db] MONGO_URI is missing. Running without database connection.");
    return;
  }

  try {
    const connection = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 15000,
    });
    console.log(`MongoDB connected: ${connection.connection.host}`);
    await cleanupStaleUserIndexes();
  } catch (err) {
    console.warn(`[db] MongoDB connection failed (${err.message}). Express server running in offline/API mode.`);
  }
};

module.exports = connectDB;
