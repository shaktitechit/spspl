/**
 * @fileoverview Shared password strength checks for create-user and change-password.
 * @module utils/passwordPolicy
 */
const { ApiError } = require('./ApiError');

const MIN_LENGTH = 10;

/**
 * @param {unknown} password
 * @param {string} [label]
 */
function assertPasswordStrength(password, label = 'Password') {
  const value = String(password || '');
  if (value.length < MIN_LENGTH) {
    throw new ApiError(400, `${label} must be at least ${MIN_LENGTH} characters`);
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    throw new ApiError(400, `${label} must include at least one letter and one number`);
  }
  if (/\s/.test(value)) {
    throw new ApiError(400, `${label} must not contain spaces`);
  }
}

module.exports = {
  MIN_LENGTH,
  assertPasswordStrength,
};
