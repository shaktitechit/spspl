/**
 * @fileoverview Mongoose schema & model for ProjectActionStep.
 * @module models/ProjectActionStep
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const ACTION_STEP_STATUSES = ['pending', 'in_progress', 'under_review', 'completed', 'blocked', 'skipped'];
const ACTION_STEP_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const checklistItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    is_completed: { type: Boolean, default: false },
    completed_at: { type: Date },
    completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const stepAttachmentSchema = new mongoose.Schema(
  {
    attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment', required: true },
    name: { type: String, required: true },
    url: { type: String },
    file_type: { type: String },
    size: { type: Number },
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploaded_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const stepRemarkSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    user_name: { type: String, trim: true },
    comment: { type: String, required: true, trim: true },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const workflowActionSchema = new mongoose.Schema(
  {
    action_order: { type: Number, default: 1 },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'blocked', 'skipped'],
      default: 'pending',
    },
    assigned_to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assigned_to_user_name: { type: String, trim: true },
    started_at: { type: Date },
    completed_at: { type: Date },
    performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performed_by_name: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

const projectActionStepSchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    phase_name: { type: String, default: 'Execution', trim: true },
    step_number: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    status: {
      type: String,
      enum: ACTION_STEP_STATUSES,
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ACTION_STEP_PRIORITIES,
      default: 'medium',
      index: true,
    },

    assigned_to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assigned_to_user_name: { type: String, trim: true },
    due_date: { type: Date, index: true },
    start_date: { type: Date },
    completed_at: { type: Date },
    completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProjectActionStep' }],
    checklist: [checklistItemSchema],
    workflow_actions: [workflowActionSchema],
    attachments: [stepAttachmentSchema],
    remarks: [stepRemarkSchema],

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

projectActionStepSchema.index(
  { project_id: 1, step_number: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);

projectActionStepSchema.plugin(softDeletePlugin);

module.exports =
  mongoose.models.ProjectActionStep || mongoose.model('ProjectActionStep', projectActionStepSchema);
