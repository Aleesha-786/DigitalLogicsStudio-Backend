// Force Google DNS — router DNS blocks MongoDB Atlas SRV records
require("dns").setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const { startLocalScheduler } = require("./src/services/scheduler");

const PORT = process.env.PORT || 5000;

const validateEnvironment = () => {
  const required = ["MONGO_URI", "JWT_SECRET"];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
};

if (process.env.NODE_ENV !== "production") {
  // ── Local development ────────────────────────────────────────────────────
  (async () => {
    try {
      validateEnvironment();
      await connectDB();
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
      startLocalScheduler();
    } catch (err) {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    }
  })();

  module.exports = app;
} else {
  // ── Vercel serverless ────────────────────────────────────────────────────
  // CORS FIX: OPTIONS preflight requests must be answered immediately —
  // before connectDB() is called. Previously every preflight triggered a DB
  // connection attempt which errored/timed-out before CORS headers were sent,
  // so the browser saw no Access-Control-Allow-Origin and blocked the request.
  validateEnvironment();

  let ready = false;

  module.exports = async (req, res) => {
    // Answer preflight immediately — no DB needed
    if (req.method === "OPTIONS") {
      return app(req, res);
    }

    // Lazy-connect on first real request
    if (!ready) {
      await connectDB();
      ready = true;
    }

    app(req, res);
  };
}
