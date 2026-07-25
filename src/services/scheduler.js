const { processPendingEmails } = require("./emailQueueService");
const { runInactivityCheck, runWeeklyDigest } = require("./notificationService");

/**
 * Only call this from the long-running local/dev process (see server.js's
 * non-production branch). Never call this from the Vercel serverless
 * handler — setInterval there would just be discarded when the function
 * instance freezes/recycles between requests. Production relies on Vercel
 * Cron hitting /api/internal/run-daily-jobs instead.
 */
function startLocalScheduler() {
  // Retry anything pending/failed-and-due every minute — fast feedback while developing.
  setInterval(() => {
    processPendingEmails(20).catch((err) =>
      console.error("[scheduler] processPendingEmails error:", err.message),
    );
  }, 60 * 1000);

  // Digest + inactivity checks are idempotent per-user, so hourly polling is
  // safe — it just means a due email goes out within an hour of becoming due
  // rather than at an exact instant.
  setInterval(() => {
    runInactivityCheck().catch((err) =>
      console.error("[scheduler] runInactivityCheck error:", err.message),
    );
    runWeeklyDigest().catch((err) =>
      console.error("[scheduler] runWeeklyDigest error:", err.message),
    );
  }, 60 * 60 * 1000);

  console.log("[scheduler] Local email scheduler started (queue retry: 1m, digest/inactivity: 1h).");
}

module.exports = { startLocalScheduler };
