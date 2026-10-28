/**
 * @fileoverview ESM mongoose mirror for FlagMessage (canonical runtime schemas live in data/mongoRegistry.js).
 * @module models/FlagMessage
 */
import mongoose from "mongoose";

const flagMessageSchema = new mongoose.Schema(
  {
    flag: { type: mongoose.Schema.Types.ObjectId, ref: "OrderFlag", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sender_name: { type: String, required: true },
    sender_role: { type: String },
    sender_department: { type: String },
    message_type: {
      type: String,
      enum: ["text", "status_change", "system_event", "file"],
      default: "text",
    },
    content: { type: String, trim: true, default: "" },
    status_change: {
      from_status: String,
      to_status: String,
    },
    attachments: [
      {
        attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Attachment" },
        fileId: String,
        original_name: String,
        file_url: String,
        view_url: String,
        download_url: String,
        mime_type: String,
        size_bytes: Number,
      },
    ],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    read_by: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        read_at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

flagMessageSchema.index({ flag: 1, createdAt: 1 });

export default mongoose.models.FlagMessage || mongoose.model("FlagMessage", flagMessageSchema);
