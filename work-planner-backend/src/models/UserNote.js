/**
 * @fileoverview ESM mongoose model for UserNote (Personal Task, Visit & General Notes with Reminders and Work Plan links).
 * @module models/UserNote
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const userNoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyInfo',
      index: true,
    },
    type: {
      type: String,
      enum: ['task', 'visit', 'general'],
      default: 'task',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Untitled Note',
    },
    description: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: 'default', // 'default', 'emerald', 'blue', 'amber', 'rose', 'purple'
    },
    category: {
      type: String,
      default: 'general', // 'general', 'field_lead', 'follow_up', 'meeting', 'project', etc.
      index: true,
    },
    tags: [{ type: String, trim: true }],
    is_pinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_archived: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Task-specific attributes
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    target_date: {
      type: Date,
      default: null,
    },
    is_completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    completed_at: {
      type: Date,
      default: null,
    },

    // Visit-specific attributes
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
    },
    party_name: {
      type: String,
      trim: true,
      default: '',
    },
    party_type: {
      type: String,
      enum: ['existing', 'new_party', 'new_lead'],
      default: 'existing',
    },
    contact_person: {
      type: String,
      trim: true,
      default: '',
    },
    contact_number: {
      type: String,
      trim: true,
      default: '',
    },
    contacts: [
      {
        contact_person: { type: String, trim: true },
        contact_number: { type: String, trim: true },
      },
    ],
    locality: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    purpose: {
      type: String,
      default: 'Sales Discussion',
      trim: true,
    },
    planned_time: {
      type: String,
      trim: true,
      default: '',
    },

    // Work Plan Conversion Link
    is_converted_to_work_plan: {
      type: Boolean,
      default: false,
      index: true,
    },
    work_plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkPlan',
      default: null,
      index: true,
    },
    work_plan_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    work_plan_date: {
      type: Date,
      default: null,
      index: true,
    },
    converted_at: {
      type: Date,
      default: null,
    },

    // Reminder Configuration
    reminder: {
      enabled: { type: Boolean, default: false, index: true },
      remind_at: { type: Date, default: null, index: true },
      notify_app: { type: Boolean, default: true },
      notify_email: { type: Boolean, default: true },
      is_sent: { type: Boolean, default: false, index: true },
      sent_at: { type: Date, default: null },
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

userNoteSchema.plugin(softDeletePlugin);

// Compound indexes for efficient query performance
userNoteSchema.index({ user: 1, type: 1, is_archived: 1, is_converted_to_work_plan: 1 });
userNoteSchema.index({ user: 1, 'reminder.enabled': 1, 'reminder.is_sent': 1, 'reminder.remind_at': 1 });

module.exports = mongoose.models.UserNote || mongoose.model('UserNote', userNoteSchema);
