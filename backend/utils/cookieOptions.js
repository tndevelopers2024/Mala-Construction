const env = require('../config/env');
const { parseDurationMs } = require('./tokenUtils');

const isProduction =
  env.nodeEnv === 'production' ||
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith('https://'));

/** Base flags shared by all auth cookies. */
function baseCookieOptions() {
  // In cross-site production (e.g. Vercel -> Render), cookies MUST be SameSite=None and Secure=true.
  // In local development over plain HTTP, SameSite=Lax and Secure=false allow cookies over localhost.
  const secure = isProduction;
  const sameSite = isProduction ? 'none' : 'lax';

  // In production cross-site environments, never set domain="localhost" or invalid domains.
  // Leaving domain undefined creates a host-only cookie for the Render domain, which works correctly with credentials.
  const domain =
    isProduction
      ? env.cookie.domain && env.cookie.domain !== 'localhost' && env.cookie.domain !== 'undefined'
        ? env.cookie.domain
        : undefined
      : env.cookie.domain || undefined;

  return {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
  };
}

function accessCookieOptions() {
  return {
    ...baseCookieOptions(),
    path: '/',
    maxAge: parseDurationMs(env.jwt.accessExpiresIn),
  };
}

/**
 * Refresh cookie options.
 * Scoped to path: '/' so refresh calls always match regardless of proxy rewrites.
 */
function refreshCookieOptions(rememberMe) {
  const expiresIn = rememberMe ? env.jwt.refreshExpiresInRemember : env.jwt.refreshExpiresIn;
  return {
    ...baseCookieOptions(),
    path: '/',
    maxAge: parseDurationMs(expiresIn),
  };
}

function clearCookieOptions(path = '/') {
  return { ...baseCookieOptions(), path };
}

module.exports = { baseCookieOptions, accessCookieOptions, refreshCookieOptions, clearCookieOptions };

