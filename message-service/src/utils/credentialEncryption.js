/**
 * @fileoverview Credential encryption/decryption utility using AES-256-GCM.
 * @module utils/credentialEncryption
 */
const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

/**
 * Derives a consistent 32-byte encryption key from environment secrets.
 */
function getEncryptionKey() {
  const secret =
    env.EMAIL_ENCRYPTION_KEY ||
    process.env.EMAIL_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    env.JWT_SECRET ||
    'default-insecure-opms-encryption-key-32chars';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts a plaintext string. Idempotent: will not double-encrypt.
 * @param {string} text - The plaintext to encrypt.
 * @returns {string|null} Prefixed encrypted string (`enc:...`) or original if empty.
 */
function encrypt(text) {
  if (text === undefined || text === null || text === '') {
    return text;
  }
  const strText = String(text);
  if (strText.startsWith(PREFIX)) {
    return strText;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(strText, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine iv (16 bytes) + authTag (16 bytes) + encrypted content
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return `${PREFIX}${combined.toString('base64')}`;
}

/**
 * Decrypts an encrypted payload. Idempotent: returns plaintext directly if unencrypted.
 * @param {string} encryptedVal - The encrypted string.
 * @returns {string|null} The decrypted plaintext string.
 */
function decrypt(encryptedVal) {
  if (!encryptedVal || typeof encryptedVal !== 'string') {
    return encryptedVal;
  }

  const raw = encryptedVal.startsWith(PREFIX) ? encryptedVal.slice(PREFIX.length) : encryptedVal;

  try {
    const combined = Buffer.from(raw, 'base64');
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return encryptedVal;
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedText = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (_err) {
    // If decryption fails, return original string safely
    return encryptedVal;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
