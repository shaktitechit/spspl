const {
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  NODE_ENV,
} = require('../config/env');

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_EXPIRES_COOKIE = 'refresh_expires_at';

function durationMs(value, fallbackMs) {
  const match = /^(\d+)\s*([smhd])$/i.exec(String(value || '').trim());
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * mult[unit];
}

function cookieBaseOptions() {
  const secure = NODE_ENV === 'production';
  return {
    path: '/',
    sameSite: 'lax',
    secure,
  };
}

/**
 * @param {import('express').Response} res
 * @param {{ token: string, refreshToken: string, refreshExpiresIn?: number }} session
 */
function setAuthCookies(res, session) {
  const base = cookieBaseOptions();
  const accessMaxMs = durationMs(JWT_EXPIRES_IN, 15 * 60 * 1000);
  const refreshMaxSec =
    session.refreshExpiresIn != null && session.refreshExpiresIn > 0
      ? session.refreshExpiresIn
      : Math.floor(durationMs(JWT_REFRESH_EXPIRES_IN, 8 * 60 * 60 * 1000) / 1000);
  const refreshMaxMs = refreshMaxSec * 1000;
  const refreshExpiresAt = Date.now() + refreshMaxMs;

  res.cookie(ACCESS_COOKIE, session.token, {
    ...base,
    httpOnly: false,
    maxAge: accessMaxMs,
  });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...base,
    httpOnly: true,
    maxAge: refreshMaxMs,
  });
  res.cookie(REFRESH_EXPIRES_COOKIE, String(refreshExpiresAt), {
    ...base,
    httpOnly: false,
    maxAge: refreshMaxMs,
  });
}

/** @param {import('express').Response} res */
function clearAuthCookies(res) {
  const base = cookieBaseOptions();
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
  res.clearCookie(REFRESH_EXPIRES_COOKIE, base);
}

/** @param {import('express').Request} req */
function readRefreshTokenFromRequest(req) {
  const fromCookie = req.cookies?.[REFRESH_COOKIE] || req.cookies?.refresh_token;
  if (fromCookie) return String(fromCookie).trim();
  const body = req.body || {};
  return String(body.refreshToken || body.refresh_token || '').trim();
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_EXPIRES_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  readRefreshTokenFromRequest,
};
