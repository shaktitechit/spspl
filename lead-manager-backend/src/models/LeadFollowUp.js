/**
 * @fileoverview ESM mongoose mirror for LeadFollowUp (canonical runtime schemas live in data/mongoRegistry.js).
 * @module models/LeadFollowUp
 */
import mongoose from "mongoose";

const leadFollowUpSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: "LeadQuotation", default: null, index: true },
    follow_up_date: { type: Date, required: true, index: true },
    follow_up_time: { type: String, trim: true },
    type: {
      type: String,
      enum: ["call", "meeting", "email", "whatsapp", "visit", "demo", "note", "other"],
      default: "call",
      index: true,
    },
    notes: { type: String, trim: true },
    outcome: { type: String, trim: true },
    actions: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        action_type: {
          type: String,
          enum: ["comment", "call_log", "whatsapp_log", "meeting_note", "outcome", "rescheduled", "status_change"],
          default: "comment",
        },
        message: { type: String, required: true, trim: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        created_at: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled", "rescheduled"],
      default: "pending",
      index: true,
    },
    next_follow_up_date: { type: Date },
    completed_at: { type: Date },
    completed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.LeadFollowUp || mongoose.model("LeadFollowUp", leadFollowUpSchema);
