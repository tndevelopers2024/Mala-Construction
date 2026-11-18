const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/** Helper to skip CORS preflight OPTIONS requests so they don't count towards rate limits */
const skipPreflight = (req) => req.method === 'OPTIONS';

/**
 * General API limiter for operational endpoints (/api/*).
 * Generous threshold ensuring dashboard charts, lookups, and normal workflow queries are never choked.
 */
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs || 15 * 60 * 1000,
  max: Math.max(env.rateLimit.max || 300, 1500), // Minimum 1500 per 15 min to accommodate multi-widget dashboards
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  validate: { trustProxy: false },
  message: { success: false, message: 'Too many requests, please try again in a few moments.' },
});

/**
 * Strict limiter for sensitive authentication endpoints (login, register).
 * Guards against brute-force and credential stuffing attacks.
 * Only failed attempts count against the cap.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25, // 25 failed attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  skipSuccessfulRequests: true, // successful logins/registrations do not increment counter
  validate: { trustProxy: false },
  message: { success: false, message: 'Too many failed login attempts, please try again later.' },
});

/**
 * Limiter for token refresh (/api/auth/refresh).
 * Generous ceiling to allow background tab refreshes and multi-session sync.
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120, // 120 refresh requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  skipSuccessfulRequests: true,
  validate: { trustProxy: false },
  message: { success: false, message: 'Too many session refresh requests, please sign in again.' },
});

module.exports = { apiLimiter, authLimiter, refreshLimiter };
