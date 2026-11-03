/**
 * @fileoverview Portal & Workflow Settings Model.
 * Manages system-wide parameters and order workflow feature toggles.
 * @module models/PortalSetting
 */
import mongoose from "mongoose";

const portalSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default_portal_settings",
      unique: true,
      index: true,
    },
    system_settings: {
      platform_name: { type: String, default: "Medica OPMS" },
      support_email: { type: String, default: "support@medicaspl.com" },
      currency: { type: String, default: "INR" },
      currency_symbol: { type: String, default: "₹" },
      timezone: { type: String, default: "Asia/Kolkata" },
      order_prefix: { type: String, default: "ORD-" },
      fiscal_year_suffix: { type: Boolean, default: true },
      maintenance_mode: { type: Boolean, default: false },
      maintenance_message: {
        type: String,
        default: "System is currently undergoing scheduled maintenance.",
      },
      session_timeout_minutes: { type: Number, default: 480 },
      email_alerts_enabled: { type: Boolean, default: true },
      in_app_notifications_enabled: { type: Boolean, default: true },
    },
    workflow_settings: {
      performa_invoice_enabled: { type: Boolean, default: true },
      cost_sheet_enabled: { type: Boolean, default: true },
      kyc_verification_enabled: { type: Boolean, default: true },
      purchase_order_enabled: { type: Boolean, default: true },
      buy_back_enabled: { type: Boolean, default: false },
      buy_back_config: {
        require_inspection: { type: Boolean, default: true },
        auto_credit_ledger: { type: Boolean, default: false },
        default_valuation_rate: { type: Number, default: 30 },
        terms: {
          type: String,
          default:
            "Buy Back is subject to technical inspection and serial verification.",
        },
      },
    },
    role_access_settings: {
      sales_mapping: {
        can_see_and_map_quantity: { type: Boolean, default: true },
        can_see_and_map_volume: { type: Boolean, default: false },
        can_see_and_map_price: { type: Boolean, default: false },
      },
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.models.PortalSetting ||
  mongoose.model("PortalSetting", portalSettingSchema);

