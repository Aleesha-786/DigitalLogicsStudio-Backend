const express = require("express");
const { internalAuth } = require("../middleware/internalAuth");
const { processPendingEmails } = require("../services/emailQueueService");
const { runInactivityCheck, runWeeklyDigest } = require("../services/notificationService");

const router = express.Router();

router.use(internalAuth);

/**
 * Single entrypoint for the scheduled jobs. Vercel Cron on the free/Hobby
 * tier is limited to once per day, so instead of separate crons for "process
 * queue", "weekly digest", and "inactivity check", we run all three here.
 * Each one is idempotent (checks its own last-sent timestamps internally),
 * so calling this more or less often than strictly necessary is harmless.
 *
 * Registered as both GET and POST: Vercel Cron sends GET, but it's also
 * handy to trigger manually with POST (e.g. curl, Postman) during testing.
 */
async function runDailyJobs(req, res, next) {
  try {
    const queue = await processPendingEmails(50);
    const inactivity = await runInactivityCheck();
    const digest = await runWeeklyDigest();
    res.status(200).json({ success: true, queue, inactivity, digest });
  } catch (error) {
    next(error);
  }
}

router.get("/run-daily-jobs", runDailyJobs);
router.post("/run-daily-jobs", runDailyJobs);

// Lighter-weight endpoint if you ever want to retry the queue on its own
// (e.g. from a more frequent cron on a paid Vercel plan).
router.post("/process-email-queue", async (req, res, next) => {
  try {
    const result = await processPendingEmails(50);
    res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
