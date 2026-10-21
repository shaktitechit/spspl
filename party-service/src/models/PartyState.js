/**
 * @fileoverview Party geography — state master (belongs to country)
 * @module models/PartyState
 */

import mongoose from "mongoose";

const partyStateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PartyCountry",
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

partyStateSchema.index({ name: 1, country: 1 }, { unique: true });

export default mongoose.models.PartyState ||
  mongoose.model("PartyState", partyStateSchema);
