/**
 * @fileoverview Standardized error classes and error codes for email operations.
 * @module modules/messages/errors/emailErrors
 */
const { ApiError } = require('../../../utils/ApiError');

const EmailErrorCodes = {
  EMAIL_PROVIDER_NOT_CONFIGURED: 'EMAIL_PROVIDER_NOT_CONFIGURED',
  EMAIL_ACCOUNT_NOT_AUTHORIZED: 'EMAIL_ACCOUNT_NOT_AUTHORIZED',
  EMAIL_AUTHENTICATION_FAILED: 'EMAIL_AUTHENTICATION_FAILED',
  EMAIL_TOKEN_REFRESH_FAILED: 'EMAIL_TOKEN_REFRESH_FAILED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  EMAIL_INVALID_RECIPIENT: 'EMAIL_INVALID_RECIPIENT',
  EMAIL_ATTACHMENT_FAILED: 'EMAIL_ATTACHMENT_FAILED',
  EMAIL_UNSUPPORTED_PROVIDER: 'EMAIL_UNSUPPORTED_PROVIDER',
};

class EmailError extends ApiError {
  /**
   * @param {string} code - One of EmailErrorCodes.
   * @param {string} message - Human-readable error message.
   * @param {number} [statusCode=500] - HTTP status code.
   * @param {object} [details={}] - Optional context without secrets.
   */
  constructor(code, message, statusCode = 500, details = {}) {
    super(statusCode, message);
    this.code = code;
    this.name = 'EmailError';
    this.details = details;
  }
}

module.exports = {
  EmailErrorCodes,
  EmailError,
};
