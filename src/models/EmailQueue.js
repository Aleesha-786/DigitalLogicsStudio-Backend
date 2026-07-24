const mongoose = require("mongoose");

const EMAIL_TYPES = ["welcome", "milestone", "weekly_digest", "inactivity_reminder"];
const STATUSES = ["pending", "sent", "failed"];

const emailQueueSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    recipient: { type: String, required: true },
    type: { type: String, enum: EMAIL_TYPES, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, default: "" },

    status: { type: String, enum: STATUSES, default: "pending" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastAttemptAt: { type: Date, default: null },
    // Retry isn't due until this time — lets us do exponential backoff
    // without a separate scheduler table.
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String, default: null },
    sentAt: { type: Date, default: null },

    // Freeform context for the email (e.g. { milestone: 25 }) — handy for
    // debugging and for building templates without re-querying.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Used by the worker to find due work efficiently.
emailQueueSchema.index({ status: 1, nextAttemptAt: 1 });

const EmailQueue = mongoose.model("EmailQueue", emailQueueSchema);
EmailQueue.EMAIL_TYPES = EMAIL_TYPES;
EmailQueue.STATUSES = STATUSES;

module.exports = EmailQueue;
