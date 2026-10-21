/**
 * @fileoverview Party geography — city master (belongs to state)
 * @module models/PartyCity
 */

import mongoose from "mongoose";

const partyCitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PartyState",
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

partyCitySchema.index({ name: 1, state: 1 }, { unique: true });

export default mongoose.models.PartyCity ||
  mongoose.model("PartyCity", partyCitySchema);
