/**
 * @fileoverview ESM mongoose mirror for WorkPlanWork.
 * @module models/WorkPlanWork
 */

import mongoose from "mongoose";

const workPlanWorkSchema = new mongoose.Schema(
  {
    work_plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkPlan",
      required: false,
      default: null,
      index: true,
    },
    sales_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    plan_date: {
      type: Date,
      required: false,
      index: true,
    },
    sequence: { type: Number, required: true, min: 1, default: 1 },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    planned_start_time: Date,
    planned_end_time: Date,
    status: {
      type: String,
      enum: ["created", "pending", "in_progress", "completed", "cancelled", "skipped", "rescheduled"],
      default: "created",
      index: true,
    },
    completion_remarks: { type: String, trim: true },
    pending_remarks: { type: String, trim: true },
    in_progress_remarks: { type: String, trim: true },
    manager_remarks: { type: String, trim: true },
    rescheduled_date: Date,
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
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    created_by_role: { type: String, trim: true },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    updated_by_role: { type: String, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

workPlanWorkSchema.index(
  { work_plan: 1, sequence: 1 },
  {
    unique: true,
    partialFilterExpression: { work_plan: { $type: "objectId" }, deletedAt: null },
  }
);

export default mongoose.models.WorkPlanWork ||
  mongoose.model("WorkPlanWork", workPlanWorkSchema);
