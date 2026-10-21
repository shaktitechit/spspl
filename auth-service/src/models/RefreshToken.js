/**
 * @fileoverview Per-device refresh tokens. One family per login; only the hash is stored.
 * @module models/RefreshToken
 */
const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    family_id: { type: String, required: true, index: true },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports =
  mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
