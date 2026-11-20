/**
 * @fileoverview ESM mongoose mirror for IndiaMartWebhookLog (canonical runtime schemas live in data/mongoRegistry.js).
 * @module models/IndiaMartWebhookLog
 */
import mongoose from "mongoose";

const indiaMartWebhookLogSchema = new mongoose.Schema(
  {
    unique_query_id: { type: String, trim: true, index: true },
    sender_name: { type: String, trim: true },
    sender_mobile: { type: String, trim: true },
    sender_email: { type: String, trim: true },
    query_type: { type: String, trim: true },
    query_product_name: { type: String, trim: true },
    status: {
      type: String,
      enum: ["PROCESSED", "DUPLICATE", "INVALID", "FAILED"],
      default: "PROCESSED",
      index: true,
    },
    http_status: { type: Number, default: 200 },
    message: { type: String },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", index: true },
    ip_address: { type: String },
    request_headers: { type: mongoose.Schema.Types.Mixed },
    raw_payload: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
  },
  { timestamps: true }
);

indiaMartWebhookLogSchema.index({ createdAt: -1 });

export default mongoose.models.IndiaMartWebhookLog ||
  mongoose.model("IndiaMartWebhookLog", indiaMartWebhookLogSchema);
