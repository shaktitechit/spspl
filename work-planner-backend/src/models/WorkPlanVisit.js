/**
 * @fileoverview ESM mongoose mirror for WorkPlanVisit.
 * @module models/WorkPlanVisit
 */

import mongoose from "mongoose";

const WORK_PLAN_VISIT_STATUSES = [
  "created",
  "pending",
  "in_progress",
  "checked_in",
  "checked_out",
  "completed",
  "cancelled",
  "skipped",
  "rescheduled",
];

const workPlanVisitSchema = new mongoose.Schema(
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
    party_type: {
      type: String,
      enum: ["existing", "new_party", "new_lead", "existing_lead", "facility", "enquiry"],
      default: "existing",
      index: true,
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: false,
      index: true,
    },
    party_name: { type: String, trim: true },
    contact_person: { type: String, trim: true },
    contact_number: { type: String, trim: true },
    contact_email: { type: String, trim: true, lowercase: true },
    contacts: [
      {
        contact_person: { type: String, trim: true },
        contact_number: { type: String, trim: true },
        contact_email: { type: String, trim: true, lowercase: true }
      }
    ],
    address: { type: String, trim: true },
    planned_start_time: Date,
    planned_end_time: Date,
    purpose: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: WORK_PLAN_VISIT_STATUSES,
      default: "created",
      index: true,
    },
    pending_remarks: { type: String, trim: true },
    in_progress_remarks: { type: String, trim: true },
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
    actual_check_in: Date,
    actual_check_out: Date,
    outcome: { type: String, trim: true },
    meeting_with_doctor: { type: Boolean },
    meeting_with_purchase: { type: Boolean },
    meeting_with_finance: { type: Boolean },
    meeting_with_engineer: { type: Boolean },
    new_product_introduced: { type: Boolean },
    order_received: { type: Boolean },
    next_followup_date: Date,
    rescheduled_date: Date,
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

workPlanVisitSchema.index(
  { work_plan: 1, sequence: 1 },
  {
    unique: true,
    partialFilterExpression: { work_plan: { $type: "objectId" }, deletedAt: null },
  }
);

export default mongoose.models.WorkPlanVisit ||
  mongoose.model("WorkPlanVisit", workPlanVisitSchema);
