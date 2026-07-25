# Email Notifications

## Overview

Four notification types, all delivered through a single durable queue
(`EmailQueue` collection) and the existing Gmail/nodemailer transporter used
for password-reset OTPs.

| Type                 | Trigger                                         | Idempotency guard                          |
|-----------------------|--------------------------------------------------|---------------------------------------------|
| `welcome`             | Right after `POST /api/auth/register`            | One per user (fires once, at signup)         |
| `milestone`            | `POST /api/progress/problems/:id/complete` crosses a threshold (5, 10, 25, 50, 100, 200 by default) | `user.notifications.milestonesSent[]`        |
| `weekly_digest`        | Scheduled job, when `DIGEST_INTERVAL_DAYS` have passed since the last one — only sent if there was activity | `user.notifications.lastDigestSentAt`        |
| `inactivity_reminder`  | Scheduled job, when a user has gone `INACTIVITY_THRESHOLD_DAYS` without an attempt | `user.notifications.lastInactivityReminderAt`|

Users can opt out of all of them via `PATCH /api/auth/notifications`
(`{ optedOut: true }`), checked by every scheduled job and by
`sendWelcomeNotification` / `checkMilestones`.

## Why a queue, not fire-and-forget `sendMail()`

- **Durability** — if Gmail/SMTP is briefly down, the email isn't lost; it
  sits in `EmailQueue` as `pending` and gets retried.
- **Auditability** — every email sent (or attempted) is a row you can query:
  who, what, when, how many attempts, last error.
- **Backoff** — failures retry at 1 / 5 / 15 minute intervals (configurable
  in `emailQueueService.js`) up to `maxAttempts` (default 3), then flip to
  `failed` instead of retrying forever.

## Why "enqueue and send inline" instead of a pure background worker

Production runs as **Vercel serverless functions** — there's no
long-running process to run a `setInterval` poller in prod; each invocation
is a fresh, short-lived instance. So instead of "insert into queue, wait for
a worker to notice it," each notification is:

1. Written to `EmailQueue` (`status: pending`).
2. Sent immediately, in the same request, via `enqueueAndSend()`.
3. On success it's marked `sent` right away — no waiting.
4. On failure it stays `pending`/becomes `failed` and is picked up later by
   the retry worker.

This gets the "usually instant delivery" of synchronous sending with the
durability of a queue, without needing a broker or a dedicated worker
process — appropriate for the current traffic level (<10 visitors/hour).

## Scheduled jobs in production (no persistent worker)

Vercel Cron (`vercel.json`) hits `GET/POST /api/internal/run-daily-jobs`
once a day. That single endpoint runs all three of:

- `processPendingEmails()` — retries anything still `pending`/due
- `runInactivityCheck()`
- `runWeeklyDigest()`

All three are idempotent per-user (each checks its own "last sent"
timestamp), so calling this endpoint more or less often than exactly once a
day is harmless — this design fits inside Vercel's Hobby-tier limit of one
cron run per day without losing correctness.

The endpoint is protected by `internalAuth` middleware, checking a bearer
token against `CRON_SECRET`. Vercel automatically sends that header on cron
invocations when an env var literally named `CRON_SECRET` exists on the
project.

## Local development

`server.js`'s non-production branch starts `startLocalScheduler()`
(`src/services/scheduler.js`), which polls the queue every minute and runs
the digest/inactivity checks every hour — so you don't have to wait for or
manually trigger cron while developing.

## Extending

To add a new notification type:

1. Add a builder function to `src/utils/email.js` returning
   `{ subject, html, text }`.
2. Add the type string to `EmailQueue.EMAIL_TYPES`.
3. Call `enqueueAndSend({ userId, recipient, type, subject, html, text })`
   from wherever the trigger lives (a controller for event-based emails, or
   `notificationService.js` for scheduled ones).
