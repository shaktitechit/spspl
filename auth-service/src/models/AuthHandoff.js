/**
 * @fileoverview One-time SSO handoff codes (Mongo TTL).
 * @module models/AuthHandoff
 */
const mongoose = require('mongoose');

const authHandoffSchema = new mongoose.Schema(
  {
    code_hash: { type: String, required: true, unique: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    used_at: { type: Date, default: null },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Auto-delete shortly after expiry
authHandoffSchema.index({ expires_at: 1 }, { expireAfterSeconds: 120 });

module.exports =
  mongoose.models.AuthHandoff || mongoose.model('AuthHandoff', authHandoffSchema);
