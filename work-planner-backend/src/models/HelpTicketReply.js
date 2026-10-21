/**
 * @fileoverview Mongoose model for HelpDesk Ticket Replies and activity timeline.
 * @module models/HelpTicketReply
 */

const mongoose = require('mongoose');

const helpTicketReplySchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HelpTicket',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user_snapshot: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      department: { type: String, default: '' },
      role: { type: String, default: '' },
    },
    message: {
      type: String,
      required: true,
    },
    reply_type: {
      type: String,
      enum: ['comment', 'status_change', 'solution_proposal', 'reopen_reason', 'resolution_note', 'users_tagged'],
      default: 'comment',
      index: true,
    },
    attachments: [
      {
        file_id: { type: String, default: '' },
        filename: { type: String, default: '' },
        original_name: { type: String, default: '' },
        mime_type: { type: String, default: '' },
        size: { type: Number, default: 0 },
        url: { type: String, default: '' },
        uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        uploaded_by_name: { type: String, default: '' },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
    metadata: {
      previous_status: { type: String, default: null },
      new_status: { type: String, default: null },
      newly_tagged_names: [{ type: String }],
    },
    // Granular read receipts per individual tagged / creator member
    read_by: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        name: { type: String, default: '' },
        role: { type: String, default: '' },
        read_at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

helpTicketReplySchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.models.HelpTicketReply || mongoose.model('HelpTicketReply', helpTicketReplySchema);
