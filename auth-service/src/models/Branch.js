const mongoose = require('mongoose');

const branchBankingSchema = new mongoose.Schema(
  {
    bank_name: { type: String, trim: true, default: '' },
    account_name: { type: String, trim: true, default: '' },
    account_number: { type: String, trim: true, default: '' },
    ifsc_code: { type: String, trim: true, uppercase: true, default: '' },
    branch_name: { type: String, trim: true, default: '' },
    account_type: { type: String, trim: true, default: 'Current Account' },
    upi_id: { type: String, trim: true, default: '' },
    swift_code: { type: String, trim: true, uppercase: true, default: '' },
    is_primary: { type: Boolean, default: true },
  },
  { _id: true }
);

const branchSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyInfo',
      index: true,
    },
    branch_code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    branch_name: {
      type: String,
      required: true,
      trim: true,
    },
    branch_type: {
      type: String,
      enum: ['head_office', 'regional_office', 'warehouse', 'retail_depot', 'manufacturing_unit'],
      default: 'regional_office',
    },
    is_head_office: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },

    // 1. Physical Location & Localization
    address: {
      street: { type: String, trim: true, default: '' },
      landmark: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      state_code: { type: String, trim: true, maxlength: 4, default: '' },
      pincode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'India' },
      currency: { type: String, trim: true, default: 'INR' },
      timezone: { type: String, trim: true, default: 'Asia/Kolkata' },
      financial_year: { type: String, trim: true, default: '' },
    },

    // 2. Taxation & Regulatory Licenses (Branch Specific)
    taxation: {
      gstin: { type: String, trim: true, uppercase: true, default: '' },
      pan: { type: String, trim: true, uppercase: true, default: '' },
      cin: { type: String, trim: true, uppercase: true, default: '' },
      drug_license: { type: String, trim: true, default: '' },
      fssai_license: { type: String, trim: true, default: '' },
      invoice_footer_note: { type: String, trim: true, default: '' },
    },

    // 3. Official Communications & Contact Persons
    contact: {
      manager_name: { type: String, trim: true, default: '' },
      email: { type: String, lowercase: true, trim: true, default: '' },
      billing_email: { type: String, lowercase: true, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      alternate_phone: { type: String, trim: true, default: '' },
      website: { type: String, trim: true, default: '' },
    },

    // 4. Banking & Settlement Accounts
    banking: [branchBankingSchema],

    // 5. Invoicing & Document Sequences
    invoicing: {
      invoice_prefix: { type: String, trim: true, uppercase: true, default: '' },
      challan_prefix: { type: String, trim: true, uppercase: true, default: '' },
      quotation_prefix: { type: String, trim: true, uppercase: true, default: '' },
    },

    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

branchSchema.index({ branch_code: 1 }, { unique: true });

module.exports = mongoose.models.Branch || mongoose.model('Branch', branchSchema);
