/**
 * @fileoverview ESM mongoose mirror for IndiaMartSyncLog (canonical runtime schemas live in data/mongoRegistry.js).
 * @module models/IndiaMartSyncLog
 */
import mongoose from "mongoose";

const indiaMartSyncLogSchema = new mongoose.Schema(
  {
    run_type: {
      type: String,
      enum: ["CRON", "MANUAL"],
      default: "CRON",
      index: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "NO_RECORDS", "RATE_LIMITED", "ERROR"],
      default: "SUCCESS",
      index: true,
    },
    http_code: { type: Number },
    api_message: { type: String },
    total_records: { type: Number, default: 0 },
    new_leads_count: { type: Number, default: 0 },
    duplicate_count: { type: Number, default: 0 },
    error_count: { type: Number, default: 0 },
    lead_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lead" }],
    error_details: { type: String },
    duration_ms: { type: Number, default: 0 },
    triggered_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

indiaMartSyncLogSchema.index({ createdAt: -1 });

export default mongoose.models.IndiaMartSyncLog ||
  mongoose.model("IndiaMartSyncLog", indiaMartSyncLogSchema);
