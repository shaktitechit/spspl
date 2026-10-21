/**
 * @fileoverview Mongoose schema for User Email Notification Preferences.
 * Stores granular per-feature email notification checkboxes for all portal access users.
 * @module models/UserEmailPreference
 */

const mongoose = require('mongoose');

const DEFAULT_PREFERENCES = {
  master_email_enabled: true,

  // 1. Work Plan Lifecycle
  work_plan_created: true,
  work_plan_completed: true,
  work_plan_approved: true,
  work_plan_rejected: true,

  // 2. Directives, Remarks & Collaboration
  directive_assigned: true,
  directive_resolved: true,

  // 3. Scheduled Reminders & Daily Digests
  morning_plan_reminder: true,
  morning_manager_digest: true,
  evening_day_end_reminder: true,
  evening_manager_digest: true,
  personal_note_reminder: true,

  // 4. Expenses, Advances & Settlements
  expense_submitted: true,
  expense_status_update: true,
  tour_advance_requested: true,
  tour_advance_status: true,
  tour_advance_disbursed: true,
  expense_settlement: true,

  // 5. Help Desk & Support Requests
  help_ticket_tagged: true,
  help_ticket_reply: true,
  help_ticket_solution: true,
  help_ticket_status: true,
};

const userEmailPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Master switch
    master_email_enabled: {
      type: Boolean,
      default: true,
    },

    // 1. Work Plan Lifecycle
    work_plan_created: { type: Boolean, default: true },
    work_plan_completed: { type: Boolean, default: true },
    work_plan_approved: { type: Boolean, default: true },
    work_plan_rejected: { type: Boolean, default: true },

    // 2. Directives, Remarks & Collaboration
    directive_assigned: { type: Boolean, default: true },
    directive_resolved: { type: Boolean, default: true },

    // 3. Scheduled Reminders & Daily Digests
    morning_plan_reminder: { type: Boolean, default: true },
    morning_manager_digest: { type: Boolean, default: true },
    evening_day_end_reminder: { type: Boolean, default: true },
    evening_manager_digest: { type: Boolean, default: true },
    personal_note_reminder: { type: Boolean, default: true },

    // 4. Expenses, Advances & Settlements
    expense_submitted: { type: Boolean, default: true },
    expense_status_update: { type: Boolean, default: true },
    tour_advance_requested: { type: Boolean, default: true },
    tour_advance_status: { type: Boolean, default: true },
    tour_advance_disbursed: { type: Boolean, default: true },
    expense_settlement: { type: Boolean, default: true },

    // 5. Help Desk & Support Requests
    help_ticket_tagged: { type: Boolean, default: true },
    help_ticket_reply: { type: Boolean, default: true },
    help_ticket_solution: { type: Boolean, default: true },
    help_ticket_status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = {
  userEmailPreferenceSchema,
  DEFAULT_PREFERENCES,
};
