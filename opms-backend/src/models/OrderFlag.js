/**
 * @fileoverview ESM mongoose mirror for OrderFlag (canonical runtime schemas live in data/mongoRegistry.js).
 * @module models/OrderFlag
 */
import mongoose from "mongoose";

const orderFlagSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },

    flag_type: {
      type: String,
      enum: [
        "urgent",
        "payment_issue",
        "dispatch_issue",
        "stock_issue",
        "customer_issue",
        "document_missing",
        "approval_delay",
        "vehicle_issue",
        "pod_missing",
        "invoice_mismatch",
        "customer_dispute",
      ],
      required: true,
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    title: { type: String, required: true },
    description: String,

    blocks_order: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "dismissed"],
      default: "open",
      index: true,
    },

    department: {
      type: String,
      enum: ["sales", "finance", "account", "dispatch", "coordinator", "admin"],
    },

    raised_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    tagged_members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    message_count: { type: Number, default: 0 },
    last_message_at: Date,
    last_message_preview: String,

    due_date: Date,

    resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolved_at: Date,

    resolution_note: String,
  },
  { timestamps: true }
);

orderFlagSchema.index({ order: 1, status: 1 });

export default mongoose.model("OrderFlag", orderFlagSchema);