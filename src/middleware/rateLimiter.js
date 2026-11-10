"use strict";

/**
 * A small in-memory sliding-window rate limiter, dependency-free.
 * Good enough for a single-process demo app; swap for a Redis-backed
 * limiter (e.g. rate-limiter-flexible) before running multiple instances.
 */
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // key -> array of timestamps

  return function rateLimiter(req, res, next) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = (hits.get(key) || []).filter((t) => t > windowStart);
    timestamps.push(now);
    hits.set(key, timestamps);

    if (timestamps.length > max) {
      return res.status(429).json({ error: message || "Too many requests. Please try again later." });
    }
    next();
  };
}

module.exports = { createRateLimiter };
