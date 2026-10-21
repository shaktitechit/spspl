/**
 * @fileoverview ESM mongoose model for WorkPlanDraft (cloud running drafts).
 * @module models/WorkPlanDraft
 */

import mongoose from "mongoose";

const workPlanDraftSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: "CompanyInfo", index: true },
    plan_date: { type: Date, required: true, index: true },
    sales_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan_type: {
      type: String,
      trim: true,
    },
    remarks: { type: String, trim: true },
    location: { type: String, trim: true },
    is_discussed_with_manager: { type: Boolean, default: null },
    discussed_manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    discussed_manager_name: { type: String, trim: true },
    discussion_method: {
      type: String,
      enum: ["on_call", "on_direct_meeting", "on_email", "other"],
    },
    visits: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    works: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    last_saved_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

workPlanDraftSchema.index({ sales_user: 1, plan_date: 1 }, { unique: true });

export default mongoose.models.WorkPlanDraft || mongoose.model("WorkPlanDraft", workPlanDraftSchema);
