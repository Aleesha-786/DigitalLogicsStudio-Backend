const { createHttpError } = require("../utils/httpError");

/**
 * Guards internal endpoints meant only for the cron scheduler (or manual ops
 * calls), not the frontend. Checks for a bearer token / header matching
 * CRON_SECRET.
 *
 * Vercel Cron Jobs automatically send `Authorization: Bearer $CRON_SECRET`
 * when an env var literally named CRON_SECRET is set on the project — so
 * this "just works" with zero extra config once you set that env var.
 */
function internalAuth(req, res, next) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return next(createHttpError(500, "CRON_SECRET is not configured on the server."));
  }

  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = bearerToken || req.headers["x-cron-secret"];

  if (provided !== expected) {
    return next(createHttpError(401, "Unauthorized."));
  }

  next();
}

module.exports = { internalAuth };
