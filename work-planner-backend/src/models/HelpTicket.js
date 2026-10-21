/**
 * @fileoverview Mongoose model for HelpDesk Tickets (Help requests and requirements tagging).
 * @module models/HelpTicket
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const helpTicketSchema = new mongoose.Schema(
  {
    ticket_number: {
      type: String,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        'work_plan_support',
        'visit_assistance',
        'client_lead_requirement',
        'product_pricing_query',
        'expense_account_query',
        'technical_portal_issue',
        'urgent_coordination',
        'general_requirement',
        'other',
      ],
      default: 'general_requirement',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'solution_proposed', 'resolved', 'reopened', 'cancelled'],
      default: 'open',
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    creator_snapshot: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      department: { type: String, default: '' },
      role: { type: String, default: '' },
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyInfo',
      index: true,
    },
    // Users tagged to collaborate or provide help
    tagged_users: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        name: { type: String, default: '' },
        email: { type: String, default: '' },
        department: { type: String, default: '' },
        role: { type: String, default: '' },
        tagged_at: { type: Date, default: Date.now },
        acknowledged_at: { type: Date, default: null },
      },
    ],
    // Read state per member for fast unread count tracking & participant status
    member_read_state: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        last_read_at: { type: Date, default: Date.now },
        last_read_reply_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpTicketReply', default: null },
      },
    ],
    // Optional linkage to work planner entities
    related_entity: {
      entity_type: {
        type: String,
        enum: ['work_plan', 'visit', 'work_task', 'project', 'expense', 'lead', 'client', 'none'],
        default: 'none',
      },
      entity_id: { type: String, default: '' },
      entity_title: { type: String, default: '' },
      entity_code: { type: String, default: '' },
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
    proposed_solution: {
      solution_text: { type: String, default: '' },
      proposed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      proposed_by_name: { type: String, default: '' },
      proposed_at: { type: Date, default: null },
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
    },
    resolution_details: {
      resolved_at: { type: Date, default: null },
      resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Validated as created_by
      resolved_by_name: { type: String, default: '' },
      resolution_notes: { type: String, default: '' },
      satisfaction_rating: { type: Number, min: 1, max: 5, default: null },
    },
    reopen_history: [
      {
        reopened_at: { type: Date, default: Date.now },
        reopened_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reopened_by_name: { type: String, default: '' },
        reason: { type: String, default: '' },
      },
    ],
    replies_count: {
      type: Number,
      default: 0,
    },
    last_activity_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    due_date: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

helpTicketSchema.plugin(softDeletePlugin);

// Compound indexes for rapid query performance
helpTicketSchema.index({ created_by: 1, status: 1 });
helpTicketSchema.index({ 'tagged_users.user': 1, status: 1 });
helpTicketSchema.index({ status: 1, priority: 1, category: 1 });
helpTicketSchema.index({ last_activity_at: -1 });

module.exports = mongoose.models.HelpTicket || mongoose.model('HelpTicket', helpTicketSchema);
