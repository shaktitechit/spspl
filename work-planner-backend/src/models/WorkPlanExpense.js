/**
 * @fileoverview ESM mongoose mirror for WorkPlanExpense.
 * @module models/WorkPlanExpense
 */

import mongoose from "mongoose";

const WORK_PLAN_EXPENSE_STATUSES = ["draft", "submitted", "approved", "rejected"];
const WORK_PLAN_EXPENSE_CATEGORIES = [
  "Travel",
  "Accommodation",
  "Food",
  "Communication",
  "Client Entertainment",
  "Marketing",
  "Office",
  "Miscellaneous",
];
const WORK_PLAN_EXPENSE_PAYMENT_MODES = [
  "Cash",
  "UPI",
  "Card",
  "Bank Transfer",
  "Company Card",
];

const workPlanExpenseSchema = new mongoose.Schema(
  {
    work_plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkPlan",
      required: true,
      index: true,
    },
    sales_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    work_plan_visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkPlanVisit",
      default: null,
      index: true,
    },
    expense_date: { type: Date, required: true, index: true },
    category: {
      type: String,
      enum: WORK_PLAN_EXPENSE_CATEGORIES,
      required: true,
      index: true,
    },
    sub_category: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    payment_mode: {
      type: String,
      enum: WORK_PLAN_EXPENSE_PAYMENT_MODES,
      required: true,
    },
    vendor_name: { type: String, trim: true },
    bill_number: { type: String, trim: true },
    bill_date: Date,
    description: { type: String, trim: true },
    receipt_attachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
      default: null,
    },
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attachment",
      },
    ],
    start_reading: { type: Number, min: 0 },
    closing_reading: { type: Number, min: 0 },
    total_km: { type: Number, min: 0 },
    rate_per_km: { type: Number, default: 3.5 },
    start_reading_image: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
      default: null,
    },
    end_reading_image: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
      default: null,
    },
    status: {
      type: String,
      enum: WORK_PLAN_EXPENSE_STATUSES,
      default: "draft",
      index: true,
    },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approved_at: Date,
    rejection_reason: { type: String, trim: true },
    manager_remarks: { type: String, trim: true },
    settled_amount: { type: Number, default: 0, min: 0 },
    settlement_status: {
      type: String,
      enum: ["unsettled", "partially_settled", "settled"],
      default: "unsettled",
      index: true,
    },
    settlement_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkPlanExpenseSettlement",
      default: null,
      index: true,
    },
    authority_remarks: [
      {
        remark: { type: String, required: true, trim: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        user_name: { type: String, trim: true },
        role: { type: String, trim: true },
        remark_type: {
          type: String,
          enum: ["instruction", "appreciation", "objection"],
          default: "instruction",
        },
        priority: {
          type: String,
          enum: ["low", "medium", "high", "urgent"],
          default: "medium",
        },
        expected_followup_date: Date,
        status: {
          type: String,
          enum: ["pending_response", "responded", "resolved"],
          default: "pending_response",
        },
        followup_remarks: [
          {
            response: { type: String, required: true, trim: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            user_name: { type: String, trim: true },
            role: { type: String, trim: true },
            action_status: {
              type: String,
              enum: ["in_progress", "completed", "clarification_provided", "need_help", "acknowledged"],
              default: "completed",
            },
            attachments: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Attachment",
              },
            ],
            attachment_details: [
              {
                attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Attachment" },
                filename: { type: String, trim: true },
                original_name: { type: String, trim: true },
                mime_type: { type: String, trim: true },
                size: { type: Number },
                url: { type: String, trim: true },
              },
            ],
            created_at: { type: Date, default: Date.now },
          },
        ],
        resolution_remarks: { type: String, trim: true },
        resolved_at: Date,
        resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        resolved_by_name: { type: String, trim: true },
        created_at: { type: Date, default: Date.now },
      },
    ],
    deletedAt: { type: Date, default: null, index: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

workPlanExpenseSchema.index({ work_plan: 1, status: 1, deletedAt: 1 });

export default mongoose.models.WorkPlanExpense ||
  mongoose.model("WorkPlanExpense", workPlanExpenseSchema);
