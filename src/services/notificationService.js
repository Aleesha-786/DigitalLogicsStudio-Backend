const User = require("../models/User");
const UserProgress = require("../models/UserProgress");
const { enqueueAndSend } = require("./emailQueueService");
const {
  buildWelcomeEmail,
  buildMilestoneEmail,
  buildWeeklyDigestEmail,
  buildInactivityEmail,
} = require("../utils/email");

const MILESTONE_THRESHOLDS = (process.env.MILESTONE_THRESHOLDS || "5,10,25,50,100,200")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => Number.isFinite(n) && n > 0)
  .sort((a, b) => a - b);

const DIGEST_INTERVAL_DAYS = Number(process.env.DIGEST_INTERVAL_DAYS || 7);
const INACTIVITY_THRESHOLD_DAYS = Number(process.env.INACTIVITY_THRESHOLD_DAYS || 7);
const INACTIVITY_REMINDER_COOLDOWN_DAYS = Number(process.env.INACTIVITY_REMINDER_COOLDOWN_DAYS || 7);

function toDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** POST /api/auth/register calls this right after account creation. */
async function sendWelcomeNotification(user) {
  if (user.notifications?.optedOut) return;
  try {
    const { subject, html, text } = buildWelcomeEmail(user);
    await enqueueAndSend({
      userId: user._id,
      recipient: user.email,
      type: "welcome",
      subject,
      html,
      text,
    });
  } catch (err) {
    // Never let a notification failure break signup.
    console.error("sendWelcomeNotification failed:", err.message);
  }
}

/**
 * POST /api/progress/problems/:id/complete calls this after updating
 * solvedProblems. `solvedCount` is the user's new total solved count.
 */
async function checkMilestones(user, solvedCount) {
  if (user.notifications?.optedOut) return;
  try {
    const alreadySent = user.notifications?.milestonesSent || [];
    const hit = MILESTONE_THRESHOLDS.find((m) => solvedCount === m && !alreadySent.includes(m));
    if (!hit) return;

    const { subject, html, text } = buildMilestoneEmail(user, hit);
    await enqueueAndSend({
      userId: user._id,
      recipient: user.email,
      type: "milestone",
      subject,
      html,
      text,
      meta: { milestone: hit },
    });

    user.notifications.milestonesSent.push(hit);
    await user.save();
  } catch (err) {
    console.error("checkMilestones failed:", err.message);
  }
}

/**
 * Scheduled job. For every user whose last reminder (or account creation, if
 * none yet) is outside the cooldown window, check whether they've gone quiet
 * for INACTIVITY_THRESHOLD_DAYS and email them if so.
 *
 * Idempotent per-user via notifications.lastInactivityReminderAt, so this is
 * safe to call as often as the scheduler/cron likes.
 */
async function runInactivityCheck() {
  const cutoff = new Date(Date.now() - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(Date.now() - INACTIVITY_REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await User.find({
    "notifications.optedOut": { $ne: true },
    $or: [
      { "notifications.lastInactivityReminderAt": null },
      { "notifications.lastInactivityReminderAt": { $lte: cooldownCutoff } },
    ],
  });

  let sent = 0;

  for (const user of candidates) {
    const progress = await UserProgress.findOne({ userId: user._id });

    const lastActivityMs = (progress?.problemProgress || []).reduce((latest, p) => {
      const t = p.lastAttemptAt ? new Date(p.lastAttemptAt).getTime() : 0;
      return Math.max(latest, t);
    }, new Date(user.createdAt).getTime());

    if (lastActivityMs > cutoff.getTime()) continue; // still active, skip

    const daysInactive = Math.floor((Date.now() - lastActivityMs) / (24 * 60 * 60 * 1000));

    try {
      const { subject, html, text } = buildInactivityEmail(user, daysInactive);
      await enqueueAndSend({
        userId: user._id,
        recipient: user.email,
        type: "inactivity_reminder",
        subject,
        html,
        text,
        meta: { daysInactive },
      });

      user.notifications.lastInactivityReminderAt = new Date();
      await user.save();
      sent += 1;
    } catch (err) {
      console.error(`runInactivityCheck: failed for user ${user._id}:`, err.message);
    }
  }

  return { checked: candidates.length, sent };
}

/**
 * Scheduled job. For every user due for a digest (DIGEST_INTERVAL_DAYS since
 * their last one, or never sent), summarize activity since then and email it
 * — but only if they actually did something. Silent users are covered by the
 * inactivity job instead, so we don't send an empty "you did nothing" email.
 */
async function runWeeklyDigest() {
  const dueCutoff = new Date(Date.now() - DIGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await User.find({
    "notifications.optedOut": { $ne: true },
    $or: [
      { "notifications.lastDigestSentAt": null },
      { "notifications.lastDigestSentAt": { $lte: dueCutoff } },
    ],
  });

  let sent = 0;

  for (const user of candidates) {
    const progress = await UserProgress.findOne({ userId: user._id });
    if (!progress) continue;

    const since = user.notifications.lastDigestSentAt || user.createdAt;
    const sinceKey = toDateKey(since);
    const weekLogs = (progress.activityLog || []).filter((d) => d.dateKey >= sinceKey);

    const stats = weekLogs.reduce(
      (acc, d) => ({
        attempts: acc.attempts + d.attempts,
        solved: acc.solved + d.solved,
        topicsOpened: acc.topicsOpened + d.topicsOpened,
      }),
      { attempts: 0, solved: 0, topicsOpened: 0 },
    );

    if (stats.attempts === 0 && stats.solved === 0 && stats.topicsOpened === 0) continue;

    try {
      const { subject, html, text } = buildWeeklyDigestEmail(user, stats);
      await enqueueAndSend({
        userId: user._id,
        recipient: user.email,
        type: "weekly_digest",
        subject,
        html,
        text,
        meta: stats,
      });

      user.notifications.lastDigestSentAt = new Date();
      await user.save();
      sent += 1;
    } catch (err) {
      console.error(`runWeeklyDigest: failed for user ${user._id}:`, err.message);
    }
  }

  return { checked: candidates.length, sent };
}

module.exports = {
  sendWelcomeNotification,
  checkMilestones,
  runInactivityCheck,
  runWeeklyDigest,
};
