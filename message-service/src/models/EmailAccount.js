/**
 * @fileoverview Mongoose model for EmailAccount (OAuth credentials & email accounts).
 * @module models/EmailAccount
 */
const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/credentialEncryption');

const emailAccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['microsoft', 'google', 'smtp'],
      required: true,
      index: true,
    },
    authType: {
      type: String,
      enum: [
        'microsoft_client_credentials',
        'google_oauth',
        'google_domain_wide_delegation',
        'smtp_password',
      ],
      required: true,
    },
    accessToken: {
      type: String,
      set: (val) => (val ? encrypt(val) : val),
      get: (val) => (val ? decrypt(val) : val),
    },
    refreshToken: {
      type: String,
      set: (val) => (val ? encrypt(val) : val),
      get: (val) => (val ? decrypt(val) : val),
    },
    accessTokenExpiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'revoked', 'error'],
      default: 'active',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

/**
 * Returns a sanitized representation of the account suitable for API responses.
 * Strictly omits accessToken and refreshToken.
 */
emailAccountSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    email: this.email,
    provider: this.provider,
    authType: this.authType,
    status: this.status,
    accessTokenExpiresAt: this.accessTokenExpiresAt,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const EmailAccount =
  mongoose.models.EmailAccount || mongoose.model('EmailAccount', emailAccountSchema);

module.exports = EmailAccount;
