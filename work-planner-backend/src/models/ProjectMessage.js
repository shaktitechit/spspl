/**
 * @fileoverview Mongoose schema & model for ProjectMessage (Chat Room).
 * @module models/ProjectMessage
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const chatAttachmentSchema = new mongoose.Schema(
  {
    attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment', required: true },
    original_name: { type: String, required: true },
    mime_type: { type: String },
    size_bytes: { type: Number },
    file_url: { type: String },
  },
  { _id: true }
);

const projectMessageSchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    action_step_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectActionStep',
      default: null,
      index: true,
    },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender_name: { type: String, required: true, trim: true },
    sender_role: { type: String, trim: true },
    message_type: {
      type: String,
      enum: ['text', 'file', 'image', 'system_event'],
      default: 'text',
    },
    content: { type: String, default: '', trim: true },
    attachments: [chatAttachmentSchema],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    is_pinned: { type: Boolean, default: false, index: true },
    pinned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pinned_at: { type: Date },
    read_by: [
      {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        read_at: { type: Date, default: Date.now },
      },
    ],
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

projectMessageSchema.index({ project_id: 1, createdAt: -1 });

projectMessageSchema.plugin(softDeletePlugin);

module.exports = mongoose.models.ProjectMessage || mongoose.model('ProjectMessage', projectMessageSchema);
