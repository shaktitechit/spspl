/**
 * @fileoverview ESM mongoose mirror for WorkPlan.
 * @module models/WorkPlan
 */

import mongoose from "mongoose";

const WORK_PLAN_STATUSES = ["planned", "draft", "submitted", "approved", "rejected", "completed"];

const workPlanSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: "CompanyInfo", index: true },
    plan_date: { type: Date, required: true, index: true },
    sales_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: WORK_PLAN_STATUSES,
      default: "planned",
      index: true,
    },
    plan_type: {
      type: String,
      enum: ["Visits", "Tasks & Visits", "Leave", "Work From Home", "Work From Office"],
      default: "Visits",
      index: true,
    },
    remarks: { type: String, trim: true },
    /** Free-text location / city for the day's plan. */
    location: { type: String, trim: true },
    is_discussed_with_manager: { type: Boolean, default: false },
    discussed_manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    discussed_manager_name: { type: String, trim: true },
    discussion_method: {
      type: String,
      enum: ["on_call", "on_direct_meeting", "on_email", "other"],
    },
    submitted_at: Date,
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approved_at: Date,
    rejection_reason: { type: String, trim: true },
    manager_remarks: { type: String, trim: true },
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
    day_end: {
      completed_at: Date,
      from_email: { type: String, trim: true },
      to_email: { type: String, trim: true },
      cc_emails: [{ type: String, trim: true }],
      subject: { type: String, trim: true },
      body_html: { type: String },
      attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
    },
    deletedAt: { type: Date, default: null, index: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

workPlanSchema.index(
  { sales_user: 1, plan_date: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);

export default mongoose.models.WorkPlan || mongoose.model("WorkPlan", workPlanSchema);
