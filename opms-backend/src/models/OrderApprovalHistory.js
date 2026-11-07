/**
 * @fileoverview ESM mongoose mirror for OrderApprovalHistory (canonical runtime schemas live in data/mongoRegistry.js).
 * @module models/OrderApprovalHistory
 */
import mongoose from "mongoose";

const orderApprovalHistorySchema = new mongoose.Schema(
  {
    order_approval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderApproval",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    revision_number: {
      type: Number,
      default: 1,
      index: true,
    },
    stage: {
      type: String,
      default: "amended",
      index: true,
    },
    department: {
      type: String,
      enum: ["sales", "coordinator", "admin", "finance", "account", "system"],
      default: "admin",
      index: true,
    },
    action: {
      type: String,
      default: "amended",
    },
    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    changed_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      default: "",
    },
    financials: {
      previous_approved_total: { type: Number, default: 0 },
      new_approved_total: { type: Number, default: 0 },
      previous_ordered_total: { type: Number, default: 0 },
      new_ordered_total: { type: Number, default: 0 },
      difference_approved_total: { type: Number, default: 0 },
    },
    changes: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    snapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { timestamps: true }
);

orderApprovalHistorySchema.index({ order_approval: 1, revision_number: -1 });
orderApprovalHistorySchema.index({ order_approval: 1, changed_at: -1 });
orderApprovalHistorySchema.index({ order: 1, changed_at: -1 });

export default mongoose.model("OrderApprovalHistory", orderApprovalHistorySchema);

