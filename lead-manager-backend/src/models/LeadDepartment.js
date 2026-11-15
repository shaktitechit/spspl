/**
 * @fileoverview ESM mongoose mirror for LeadDepartment (canonical runtime schemas live in data/mongoRegistry.js).
 * @module models/LeadDepartment
 */
import mongoose from "mongoose";

const leadDepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    code: { type: String, trim: true, lowercase: true },
    description: { type: String, trim: true },
    sort_order: { type: Number, default: 100, index: true },
    is_active: { type: Boolean, default: true, index: true },
    is_system: { type: Boolean, default: false },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.LeadDepartment ||
  mongoose.model("LeadDepartment", leadDepartmentSchema);
