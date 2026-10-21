/**
 * @fileoverview ESM mongoose model for WorkPlanTourAdvance.
 * @module models/WorkPlanTourAdvance
 */

import mongoose from 'mongoose';

const TOUR_ADVANCE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'disbursed',
  'settled',
  'recovered',
  'refunded',
];

const tourAdvanceSchema = new mongoose.Schema(
  {
    advance_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    sales_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    work_plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkPlan',
      default: null,
      index: true,
    },
    request_date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: TOUR_ADVANCE_STATUSES,
      default: 'pending',
      index: true,
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approved_at: Date,
    rejection_reason: {
      type: String,
      trim: true,
    },
    disbursed_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    disbursed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    disbursed_at: Date,
    payment_method: {
      type: String,
      trim: true,
      default: 'Bank Transfer',
    },
    transaction_reference: {
      type: String,
      trim: true,
    },
    bank_name: {
      type: String,
      trim: true,
    },
    disbursement_notes: {
      type: String,
      trim: true,
    },
    settled_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remaining_balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    refunded_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attachment',
      },
    ],
    attachment_details: [
      {
        attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
        filename: { type: String, trim: true },
        original_name: { type: String, trim: true },
        mime_type: { type: String, trim: true },
        size: { type: Number },
        url: { type: String, trim: true },
      },
    ],
    disbursement_attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attachment',
      },
    ],
    disbursement_attachment_details: [
      {
        attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
        filename: { type: String, trim: true },
        original_name: { type: String, trim: true },
        mime_type: { type: String, trim: true },
        size: { type: Number },
        url: { type: String, trim: true },
      },
    ],
    refunds: [
      {
        amount: { type: Number, required: true, min: 0.01 },
        refund_date: { type: Date, default: Date.now },
        payment_method: { type: String, default: 'UPI' },
        transaction_reference: { type: String, trim: true },
        notes: { type: String, trim: true },
        attachments: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attachment',
          },
        ],
        attachment_details: [
          {
            attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
            filename: { type: String, trim: true },
            original_name: { type: String, trim: true },
            mime_type: { type: String, trim: true },
            size: { type: Number },
            url: { type: String, trim: true },
          },
        ],
        accepted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        accepted_at: { type: Date, default: Date.now },
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

tourAdvanceSchema.index({ sales_user: 1, status: 1, deletedAt: 1 });
tourAdvanceSchema.index({ request_date: -1, deletedAt: 1 });

export default mongoose.models.WorkPlanTourAdvance ||
  mongoose.model('WorkPlanTourAdvance', tourAdvanceSchema);
