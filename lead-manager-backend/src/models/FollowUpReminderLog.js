/**
 * @fileoverview ESM mongoose mirror for FollowUpReminderLog.
 * @module models/FollowUpReminderLog
 */
import mongoose from "mongoose";

const followUpReminderLogSchema = new mongoose.Schema(
  {
    follow_up: { type: mongoose.Schema.Types.ObjectId, ref: "LeadFollowUp", required: true, index: true },
    kind: {
      type: String,
      enum: ["pre_due_warning", "daily_agenda", "overdue_alert", "escalation_alert", "instant_scheduled"],
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    channel: {
      type: String,
      enum: ["in_app", "email", "whatsapp", "sms"],
      default: "in_app",
    },
    scheduled_date: { type: String, index: true },
    scheduled_time: { type: String },
    sent_at: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

followUpReminderLogSchema.index({ follow_up: 1, kind: 1, scheduled_date: 1 }, { unique: true });

export default mongoose.models.FollowUpReminderLog || mongoose.model("FollowUpReminderLog", followUpReminderLogSchema);
