const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** Blocks an IP for 15 minutes after too many login attempts (any email). */
const loginIpBlocker = rateLimit({
  windowMs: WINDOW_MS,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Try again in 15 minutes.',
  },
  keyGenerator: (req) => clientIp(req),
});

/** Per IP+email window (finer than IP-only; stops password spraying one account). */
const loginEmailRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts. Try again in 15 minutes.',
  },
  keyGenerator: (req) => {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const ip = clientIp(req);
    return email ? `${ip}:${email}` : ip;
  },
});

const handoffExchangeRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many handoff attempts. Try again in 15 minutes.',
  },
});

const refreshRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many refresh attempts. Try again in 15 minutes.',
  },
  keyGenerator: (req) => clientIp(req),
});

module.exports = {
  loginIpBlocker,
  loginEmailRateLimiter,
  handoffExchangeRateLimiter,
  refreshRateLimiter,
};
