/**
 * @fileoverview Configuration (Google Gmail API) for message-service.
 * @module config/googleGmail
 */
const env = require('./env');

function isConfigured() {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_REDIRECT_URI
  );
}

module.exports = {
  isConfigured,
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_REDIRECT_URI,
  scopes: env.GOOGLE_GMAIL_SCOPES,
};
