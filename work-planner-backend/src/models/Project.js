/**
 * @fileoverview Mongoose schema & model for Project.
 * @module models/Project
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const PROJECT_STATUSES = ['draft', 'planning', 'active', 'on_hold', 'completed', 'closed', 'cancelled'];
const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const projectMemberSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_name: { type: String, trim: true },
    user_email: { type: String, trim: true, lowercase: true },
    role: {
      type: String,
      enum: ['admin', 'lead', 'coordinator', 'contributor', 'viewer'],
      default: 'contributor',
    },
    assigned_at: { type: Date, default: Date.now },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
    title: { type: String, required: true, trim: true },
    project_code: { type: String, unique: true, sparse: true, trim: true, uppercase: true, index: true },
    description: { type: String, trim: true },
    category: { type: String, default: 'General', trim: true },
    priority: {
      type: String,
      enum: PROJECT_PRIORITIES,
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'planning',
      index: true,
    },
    start_date: { type: Date, index: true },
    target_end_date: { type: Date, index: true },
    actual_closed_date: { type: Date },
    closed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closure_remarks: { type: String, trim: true },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project_manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assigned_team_ids: [{ type: String, trim: true, index: true }],
    members: [projectMemberSchema],

    total_steps: { type: Number, default: 0 },
    completed_steps: { type: Number, default: 0 },
    progress_percentage: { type: Number, default: 0, min: 0, max: 100 },

    tags: [{ type: String, trim: true }],
    is_archived: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

projectSchema.plugin(softDeletePlugin);

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
