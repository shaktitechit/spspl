/**
 * @fileoverview Schema for User Work Planner Settings (Manager assignment & CC emails per plan type, Custom Task Templates).
 * @module models/UserWorkPlannerSettings
 */
const mongoose = require('mongoose');

const customWorkTaskTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  planned_start_time: { type: String, trim: true },
  planned_end_time: { type: String, trim: true },
  work_type: {
    type: String,
    enum: ['default', 'optional'],
    default: 'default',
  },
});

const planTypeSettingSchema = new mongoose.Schema({
  plan_type: {
    type: String,
    enum: ['Visits', 'Tasks & Visits', 'Leave', 'Work From Home', 'Work From Office'],
    required: true,
  },
  assigned_manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  cc_emails: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],
});

const userWorkPlannerSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Global fallback manager & CC emails
    assigned_manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cc_emails: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    // Per plan type configuration
    plan_type_settings: [planTypeSettingSchema],
    custom_work_templates: [customWorkTaskTemplateSchema],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = userWorkPlannerSettingsSchema;
