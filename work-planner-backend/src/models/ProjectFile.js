/**
 * @fileoverview Mongoose schema & model for ProjectFile (Central Document Hub).
 * @module models/ProjectFile
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const projectFileSchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    action_step_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectActionStep',
      default: null,
      index: true,
    },
    attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment', required: true },
    file_name: { type: String, required: true, trim: true },
    folder: { type: String, default: 'General', trim: true, index: true },
    mime_type: { type: String, trim: true },
    size_bytes: { type: Number },
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    uploader_name: { type: String, trim: true },
    version: { type: Number, default: 1 },
    is_archived: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

projectFileSchema.index({ project_id: 1, folder: 1, createdAt: -1 });

projectFileSchema.plugin(softDeletePlugin);

module.exports = mongoose.models.ProjectFile || mongoose.model('ProjectFile', projectFileSchema);
