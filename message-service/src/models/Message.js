/**
 * @fileoverview Mongoose model for Message.
 * @module models/Message
 */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    recipient: { type: String, required: true, index: true },
    from: { type: String },
    cc: { type: mongoose.Schema.Types.Mixed },
    channel: { type: String, enum: ['email', 'whatsapp'], required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'queued', 'sending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    subject: { type: String },
    body: { type: String },
    templateName: { type: String },
    templateParams: { type: mongoose.Schema.Types.Mixed },
    attachments: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    attempts: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
    sentAt: { type: Date },
    failedAt: { type: Date },
  },
  { timestamps: true }
);

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

module.exports = Message;
