const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('./errorHandler');
const User = require('../models/User');

/**
 * Verifies the access token (httpOnly cookie, falling back to Authorization
 * header for non-browser clients) and attaches the authenticated user to req.user.
 *
 * This only checks "is authenticated". Role and site-ownership checks are
 * separate middleware (see authorize.js) so route definitions read as:
 *   router.get('/', authenticate, authorize('super_admin'), controller.list)
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const tokenFromCookie = req.cookies?.accessToken;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    throw ApiError.unauthorized('Unauthorized. Please log in again.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.accessSecret);
  } catch (err) {
    throw ApiError.unauthorized('Unauthorized. Please log in again.');
  }

  const user = await User.findById(payload.sub).select('-password');
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('Unauthorized. Please log in again.');
  }

  req.user = user; // { _id, role, assignedSite, ... }
  next();
});

/**
 * Optional authentication: attaches req.user if a valid token is present,
 * but allows the request to continue without failing if no token or an expired token is provided.
 * Useful for endpoints like /logout.
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const tokenFromCookie = req.cookies?.accessToken;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    const user = await User.findById(payload.sub).select('-password');
    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch {
    // Ignore invalid/expired tokens in optional authentication
  }

  next();
});

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;
