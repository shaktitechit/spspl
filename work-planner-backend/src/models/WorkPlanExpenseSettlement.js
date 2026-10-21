/**
 * @fileoverview ESM mongoose model for WorkPlanExpenseSettlement.
 * @module models/WorkPlanExpenseSettlement
 */

import mongoose from 'mongoose';

const expenseSettlementSchema = new mongoose.Schema(
  {
    settlement_number: {
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
    settlement_date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    claims: [
      {
        expense: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlanExpense',
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        category: String,
        description: String,
        expense_date: Date,
      },
    ],
    advances: [
      {
        advance: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlanTourAdvance',
          required: true,
        },
        deducted_amount: {
          type: Number,
          required: true,
          min: 0,
        },
        advance_number: String,
      },
    ],
    total_claim_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    advance_deduction_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    direct_payment_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    settlement_mode: {
      type: String,
      enum: ['advance_deduction', 'direct_payment', 'split'],
      required: true,
      default: 'direct_payment',
    },
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
    settlement_notes: {
      type: String,
      trim: true,
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
    settled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    settled_at: {
      type: Date,
      default: Date.now,
    },
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

expenseSettlementSchema.index({ sales_user: 1, settlement_date: -1, deletedAt: 1 });

export default mongoose.models.WorkPlanExpenseSettlement ||
  mongoose.model('WorkPlanExpenseSettlement', expenseSettlementSchema);
