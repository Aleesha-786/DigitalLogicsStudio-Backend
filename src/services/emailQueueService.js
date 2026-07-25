const EmailQueue = require("../models/EmailQueue");
const { getTransporter } = require("../utils/email");

// Delay (minutes) before retry #2, #3, #4... last value repeats after that.
const BACKOFF_MINUTES = [1, 5, 15];

async function enqueueEmail({ userId = null, recipient, type, subject, html, text = "", meta = {} }) {
  return EmailQueue.create({ userId, recipient, type, subject, html, text, meta });
}

async function attemptSend(doc) {
  const mailer = getTransporter();
  await mailer.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || "Digital Logics Studio"}" <${process.env.GMAIL_USER}>`,
    to: doc.recipient,
    subject: doc.subject,
    text: doc.text,
    html: doc.html,
  });
}

/** Attempt to send a single queued email and persist the resulting state. */
async function processQueueItem(doc) {
  doc.attempts += 1;
  doc.lastAttemptAt = new Date();

  try {
    await attemptSend(doc);
    doc.status = "sent";
    doc.sentAt = new Date();
    doc.lastError = null;
  } catch (err) {
    doc.lastError = err.message;
    if (doc.attempts >= doc.maxAttempts) {
      doc.status = "failed";
    } else {
      const delayMin = BACKOFF_MINUTES[Math.min(doc.attempts - 1, BACKOFF_MINUTES.length - 1)];
      doc.nextAttemptAt = new Date(Date.now() + delayMin * 60 * 1000);
    }
  }

  await doc.save();
  return doc;
}

/**
 * Enqueue a notification and immediately attempt to send it inline.
 *
 * Why inline instead of "insert and wait for the worker"? Production runs on
 * Vercel serverless, where nothing persists between requests — a polling
 * worker would never actually run there. Sending inline gets the email out
 * within the same request in the common case, while still writing to
 * EmailQueue first so a transient failure is durable and gets retried by the
 * cron-driven worker below instead of being silently lost.
 *
 * Callers should NOT let a rejection here fail the parent request (signup,
 * marking a problem solved, etc). Wrap calls in try/catch and just log.
 */
async function enqueueAndSend(payload) {
  const doc = await enqueueEmail(payload);
  return processQueueItem(doc);
}

/** Batch-process anything pending and due — used by the retry worker/cron. */
async function processPendingEmails(batchSize = 20) {
  const due = await EmailQueue.find({
    status: "pending",
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ nextAttemptAt: 1 })
    .limit(batchSize);

  const results = { processed: due.length, sent: 0, failed: 0, stillPending: 0 };

  for (const doc of due) {
    const updated = await processQueueItem(doc);
    if (updated.status === "sent") results.sent += 1;
    else if (updated.status === "failed") results.failed += 1;
    else results.stillPending += 1;
  }

  return results;
}

module.exports = { enqueueEmail, enqueueAndSend, processQueueItem, processPendingEmails };
