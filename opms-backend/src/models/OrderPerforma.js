/**
 * @fileoverview ESM mongoose mirror for OrderPerforma.
 * (canonical runtime schemas live in data/mongoRegistry.js)
 * @module models/OrderPerforma
 */
import mongoose from "mongoose";

const orderPerformaSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    order_no: {
      type: String,
      required: true,
      index: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyInfo",
      index: true,
    },
    sales_person: {
      type: String,
      default: "",
      trim: true,
    },
    freight_charges: {
      type: String,
      default: "",
      trim: true,
    },
    orc: {
      type: String,
      default: "",
      trim: true,
    },
    transport: {
      type: String,
      default: "",
      trim: true,
    },
    dispatch_date: {
      type: Date,
      default: null,
    },
    ship_to_address: {
      type: String,
      default: "",
      trim: true,
    },
    payment_terms: {
      type: String,
      default: "",
      trim: true,
    },
    customer_type: {
      type: String,
      default: "",
      trim: true,
    },
    installation_required: {
      type: String,
      default: "",
      trim: true,
    },
    gst_concession: {
      type: String,
      default: "",
      trim: true,
    },
    margin_sheet_attached: {
      type: String,
      default: "",
      trim: true,
    },
    kyc_status: {
      type: String,
      default: "",
      trim: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    po_attachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
    },
    cost_sheet_attachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
    },
    aadhaar_attachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
    },
    pan_attachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
    },
    gst_attachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attachment",
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
  {
    timestamps: true,
  }
);

export default mongoose.model("OrderPerforma", orderPerformaSchema);
