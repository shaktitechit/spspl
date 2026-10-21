/**
 * @fileoverview Registers all mongoose models/schemas used by lead-manager-backend.
 * @module data/mongoRegistry
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

let _cached = null;

function registerModels() {
  // User schema
  if (!mongoose.models.User) {
    const userSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        phone: { type: String, trim: true },
        department: { type: String, trim: true },
        is_active: { type: Boolean, default: true },
        portals: { type: mongoose.Schema.Types.Mixed },
      },
      { timestamps: true }
    );
    mongoose.model('User', userSchema);
  }

  // Party schema
  if (!mongoose.models.Party) {
    const partySchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        party_name: { type: String, required: true, trim: true },
        legal_name: { type: String, trim: true },
        party_type: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    partySchema.plugin(softDeletePlugin);
    mongoose.model('Party', partySchema);
  }

  // Attachment schema
  if (!mongoose.models.Attachment) {
    const attachmentSchema = new mongoose.Schema(
      {
        filename: { type: String },
        original_name: { type: String },
        mime_type: { type: String },
        size: { type: Number },
        storage_path: { type: String },
        url: { type: String },
        entity_type: { type: String, default: 'lead', index: true },
        entity_id: { type: String, index: true },
        uploaded_by: { type: Object },
        remarks: { type: String },
        deletedAt: { type: Date, default: null },
      },
      { timestamps: true }
    );
    mongoose.model('Attachment', attachmentSchema);
  }

  // Notification schema
  if (!mongoose.models.Notification) {
    const notificationSchema = new mongoose.Schema(
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        type: { type: String, default: 'info' },
        module: { type: String, default: 'lead_manager' },
        entity_type: String,
        entity_id: mongoose.Schema.Types.ObjectId,
        is_read: { type: Boolean, default: false, index: true },
        read_at: Date,
      },
      { timestamps: true }
    );
    mongoose.model('Notification', notificationSchema);
  }

  // ActivityLog schema
  if (!mongoose.models.ActivityLog) {
    const activityLogSchema = new mongoose.Schema(
      {
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        entity_type: { type: String, required: true, index: true },
        entity_id: { type: mongoose.Schema.Types.ObjectId, index: true },
        action: { type: String, required: true },
        message: String,
        old_value: mongoose.Schema.Types.Mixed,
        new_value: mongoose.Schema.Types.Mixed,
        ip_address: String,
        user_agent: String,
      },
      { timestamps: true }
    );
    mongoose.model('ActivityLog', activityLogSchema);
  }

  // LeadSource schema
  if (!mongoose.models.LeadSource) {
    const leadSourceSchema = new mongoose.Schema(
      {
        name: { type: String, required: true, unique: true, trim: true, index: true },
        code: { type: String, trim: true, lowercase: true },
        description: { type: String, trim: true },
        is_active: { type: Boolean, default: true, index: true },
        is_system: { type: Boolean, default: false },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    leadSourceSchema.plugin(softDeletePlugin);
    mongoose.model('LeadSource', leadSourceSchema);
  }

  // LeadLostReason schema
  if (!mongoose.models.LeadLostReason) {
    const leadLostReasonSchema = new mongoose.Schema(
      {
        name: { type: String, required: true, unique: true, trim: true, index: true },
        code: { type: String, trim: true, lowercase: true },
        description: { type: String, trim: true },
        is_active: { type: Boolean, default: true, index: true },
        is_system: { type: Boolean, default: false },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    leadLostReasonSchema.plugin(softDeletePlugin);
    mongoose.model('LeadLostReason', leadLostReasonSchema);
  }

  // Lead schema
  if (!mongoose.models.Lead) {
    const leadProductItemSchema = new mongoose.Schema(
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        product_name: { type: String, required: true, trim: true },
        quantity: { type: Number, default: 1, min: 1 },
        target_price: { type: Number, default: 0, min: 0 },
        unit: { type: String, default: 'pcs' },
        remarks: String,
      },
      { _id: true }
    );

    const leadContactSchema = new mongoose.Schema(
      {
        name: { type: String, trim: true },
        department: { type: String, trim: true },
        designation: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, lowercase: true, trim: true },
        alternate_phone: { type: String, trim: true },
        is_primary: { type: Boolean, default: false },
      },
      { _id: true }
    );

    const leadSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        lead_no: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true, trim: true, index: true },
        company_name: { type: String, trim: true, index: true },
        email: { type: String, lowercase: true, trim: true, index: true },
        phone: { type: String, trim: true, index: true },
        alternate_phone: { type: String, trim: true },
        contacts: { type: [leadContactSchema], default: [] },

        industry: { type: String, trim: true },
        designation: { type: String, trim: true },
        billing_address: {
          address_line_1: String,
          address_line_2: String,
          city: { type: String, trim: true },
          state: { type: String, trim: true },
          pincode: { type: String, trim: true },
          country: { type: String, default: 'India' },
          country_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCountry' },
          state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyState' },
          city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCity' },
        },

        requirement: { type: String, trim: true },
        estimated_value: { type: Number, default: 0, min: 0, index: true },
        expected_closing_date: { type: Date, index: true },

        source: { type: String, required: true, trim: true, index: true },
        source_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadSource' },

        status: {
          type: String,
          enum: [
            'new',
            'assigned',
            'contacted',
            'qualified',
            'unqualified',
            'follow_up',
            'quotation',
            'negotiation',
            'won',
            'lost',
            'converted',
          ],
          default: 'new',
          index: true,
        },

        priority: {
          type: String,
          enum: ['low', 'medium', 'high', 'urgent'],
          default: 'medium',
          index: true,
        },

        department: { type: String, trim: true, default: 'sales', index: true },
        assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        assigned_users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
        assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        assigned_at: Date,

        party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', index: true },
        contact_person_id: { type: String, trim: true },

        products: { type: [leadProductItemSchema], default: [] },
        notes: { type: String, trim: true },
        tags: [{ type: String, trim: true, lowercase: true }],

        qualification: {
          requirement_confirmed: { type: Boolean, default: false },
          budget_available: { type: Boolean, default: false },
          decision_maker_known: { type: Boolean, default: false },
          purchase_timeline: { type: String, trim: true },
          competition: { type: String, trim: true },
          qualification_notes: { type: String, trim: true },
          qualified_at: Date,
          qualified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },

        lost_info: {
          lost_reason: { type: String, trim: true },
          lost_reason_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadLostReason' },
          lost_remarks: { type: String, trim: true },
          lost_at: Date,
          lost_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },

        conversion: {
          converted_at: Date,
          converted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          conversion_type: {
            type: String,
            enum: ['existing_customer', 'new_customer', 'quotation', 'order'],
            trim: true,
          },
          party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
          order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
          quotation_id: { type: mongoose.Schema.Types.ObjectId },
          notes: String,
        },

        last_contacted_at: Date,
        next_follow_up_at: { type: Date, index: true },
        last_activity_at: { type: Date, default: Date.now, index: true },

        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );

    leadSchema.index({ phone: 1, deletedAt: 1 });
    leadSchema.index({ email: 1, deletedAt: 1 });
    leadSchema.index({ company_name: 1, deletedAt: 1 });
    leadSchema.index({ status: 1, assigned_to: 1, deletedAt: 1 });
    leadSchema.index({ next_follow_up_at: 1, assigned_to: 1, deletedAt: 1 });
    leadSchema.plugin(softDeletePlugin);
    mongoose.model('Lead', leadSchema);
  }

  // LeadFollowUp schema
  if (!mongoose.models.LeadFollowUp) {
    const leadFollowUpSchema = new mongoose.Schema(
      {
        lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null, index: true },
        quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadQuotation', default: null, index: true },
        follow_up_date: { type: Date, required: true, index: true },
        follow_up_time: { type: String, trim: true },
        type: {
          type: String,
          enum: ['call', 'meeting', 'email', 'whatsapp', 'visit', 'demo', 'other'],
          default: 'call',
          index: true,
        },
        notes: { type: String, trim: true },
        outcome: { type: String, trim: true },
        status: {
          type: String,
          enum: ['pending', 'completed', 'cancelled', 'rescheduled'],
          default: 'pending',
          index: true,
        },
        next_follow_up_date: { type: Date },
        completed_at: { type: Date },
        completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    leadFollowUpSchema.plugin(softDeletePlugin);
    mongoose.model('LeadFollowUp', leadFollowUpSchema);
  }

  // Idempotency log for scheduled digests (one row per user + calendar day)
  if (!mongoose.models.FollowUpDigestLog) {
    const followUpDigestLogSchema = new mongoose.Schema(
      {
        kind: { type: String, required: true, default: 'todays_followups', index: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        digest_date: { type: String, required: true, index: true }, // YYYY-MM-DD in reminder TZ
        follow_up_count: { type: Number, default: 0 },
        sent_at: { type: Date, default: Date.now },
      },
      { timestamps: true }
    );
    followUpDigestLogSchema.index({ kind: 1, user: 1, digest_date: 1 }, { unique: true });
    mongoose.model('FollowUpDigestLog', followUpDigestLogSchema);
  }

  // LeadQuotation schema
  if (!mongoose.models.LeadQuotation) {
    const leadQuotationSchema = new mongoose.Schema(
      {
        quotation_no: { type: String, required: true, unique: true, index: true },
        ref_no: { type: String, trim: true, default: '' },
        customer_ref: { type: String, trim: true, default: '' },
        lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null, index: true },
        party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
        quotation_date: { type: Date, default: Date.now },
        valid_until: { type: Date },
        validity_days: { type: Number, default: 15 },
        subject: { type: String, trim: true, default: '' },
        message: { type: String, default: '' },
        quotation_message: { type: String, default: '' },
        customer_name: { type: String, trim: true, default: '' },
        kind_attn: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        cell: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, default: '' },
        gstin: { type: String, trim: true, uppercase: true, default: '' },
        address: {
          address_line_1: { type: String, default: '' },
          city: { type: String, default: '' },
          state: { type: String, default: '' },
          pincode: { type: String, default: '' },
          country: { type: String, default: 'India' },
          country_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCountry' },
          state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyState' },
          city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCity' },
        },
        items: [
          {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            product_name: { type: String, required: true },
            description: { type: String, default: '' },
            hsn_code: { type: String, default: '' },
            quantity: { type: Number, required: true, default: 1 },
            unit: { type: String, default: 'Nos' },
            rate: { type: Number, required: true, default: 0 },
            discount_percent: { type: Number, default: 0 },
            discount_amount: { type: Number, default: 0 },
            taxable_amount: { type: Number, required: true, default: 0 },
            gst_enabled: { type: Boolean, default: true },
            gst_rate: { type: Number, default: 0 },
            cgst_rate: { type: Number, default: 0 },
            cgst_amount: { type: Number, default: 0 },
            sgst_rate: { type: Number, default: 0 },
            sgst_amount: { type: Number, default: 0 },
            igst_rate: { type: Number, default: 0 },
            igst_amount: { type: Number, default: 0 },
            total_gst_amount: { type: Number, default: 0 },
            line_total: { type: Number, required: true, default: 0 },
          },
        ],
        total_discount: { type: Number, default: 0 },
        subtotal: { type: Number, default: 0 },
        gst_enabled: { type: Boolean, default: true },
        total_gst: { type: Number, default: 0 },
        round_off: { type: Number, default: 0 },
        grand_total: { type: Number, default: 0 },
        amount_in_words: { type: String, default: '' },
        terms_and_conditions: [{ type: String }],
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        branch_code: { type: String, default: '' },
        company_branch_name: { type: String, default: '' },
        company_name: { type: String, default: '' },
        company_regd_address: { type: String, default: '' },
        company_phone: { type: String, default: '' },
        company_email: { type: String, default: '' },
        company_gstin: { type: String, default: '' },
        bank_name: { type: String, default: '' },
        account_name: { type: String, default: '' },
        account_number: { type: String, default: '' },
        ifsc_code: { type: String, default: '' },
        branch_name: { type: String, default: '' },
        account_type: { type: String, default: 'Current Account' },
        signatory_name: { type: String, default: '' },
        signatory_phone: { type: String, default: '' },
        signatory_email: { type: String, default: '' },
        signatory_designation: { type: String, default: '' },
        signatory_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
        sales_person_name: { type: String, trim: true, default: '' },
        sales_person_phone: { type: String, trim: true, default: '' },
        sales_person_email: { type: String, trim: true, default: '' },
        sales_person_designation: { type: String, trim: true, default: 'Sales Executive' },
        sales_person_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
        approval_status: {
          type: String,
          enum: ['pending_approval', 'approved', 'rejected'],
          default: 'pending_approval',
          index: true,
        },
        approved_at: { type: Date, default: null },
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejection_reason: { type: String, default: '' },
        status: {
          type: String,
          enum: ['draft', 'pending_approval', 'approved', 'sent', 'in_negotiation', 'accepted', 'rejected', 'expired', 'on_hold', 'converted'],
          default: 'pending_approval',
          index: true,
        },
        version: { type: Number, default: 1 },
        revision_of: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadQuotation', default: null, index: true },
        revision_history: [
          {
            version: { type: Number, required: true },
            items: { type: Array, default: [] },
            subtotal: { type: Number, default: 0 },
            total_discount: { type: Number, default: 0 },
            total_gst: { type: Number, default: 0 },
            round_off: { type: Number, default: 0 },
            grand_total: { type: Number, default: 0 },
            amount_in_words: { type: String, default: '' },
            terms_and_conditions: { type: Array, default: [] },
            signatory_name: { type: String, default: '' },
            signatory_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            sales_person_name: { type: String, default: '' },
            sales_person_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            status: { type: String, default: '' },
            approval_status: { type: String, default: '' },
            approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            approved_at: { type: Date, default: null },
            saved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            saved_at: { type: Date, default: Date.now },
            change_summary: { type: String, default: '' },
          },
        ],
        lost_reason: { type: String, default: '' },
        proforma_issued_at: { type: Date, default: null },
        customer_po_number: { type: String, trim: true, default: '' },
        customer_po_date: { type: Date, default: null },
        advance_amount: { type: Number, default: 0 },
        payment_mode: { type: String, trim: true, default: '' },
        payment_reference: { type: String, trim: true, default: '' },
        proforma_details: {
          proforma_no: { type: String, trim: true, default: '' },
          invoice_date: { type: Date, default: null },
          customer_po_number: { type: String, trim: true, default: '' },
          customer_po_date: { type: Date, default: null },
          sales_person: { type: String, trim: true, default: '' },
          orc: { type: String, default: 'na' },
          dispatch_date: { type: Date, default: null },
          freight_charges: { type: String, default: 'Extra at actual' },
          payment_terms: { type: String, default: 'On Delivery' },
          transport: { type: String, default: '' },
          ship_to_address: { type: String, default: 'same as billing' },
          customer_type: { type: String, default: 'Dealer' },
          installation_required: { type: String, default: 'No' },
          gst_concession: { type: String, default: 'na' },
          margin_sheet_attached: { type: String, default: 'na' },
          kyc_status: { type: String, default: 'na' },
          remarks: { type: String, default: '' },
          message: { type: String, default: '' },
          generated_at: { type: Date, default: null },
          generated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        },
        conversion: {
          converted_at: { type: Date, default: null },
          converted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
          order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
          customer_po_number: { type: String, default: '' },
          customer_po_date: { type: Date, default: null },
          advance_amount: { type: Number, default: 0 },
          payment_mode: { type: String, default: '' },
          payment_reference: { type: String, default: '' },
          notes: { type: String, default: '' },
        },
        next_follow_up_at: { type: Date, default: null, index: true },
        last_follow_up_at: { type: Date, default: null },
        expiry_alert_sent_at: { type: Date, default: null },
        validity_extension_history: [
          {
            extended_at: { type: Date, default: Date.now },
            extended_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            previous_valid_until: { type: Date },
            new_valid_until: { type: Date },
            reason: { type: String, default: '' },
          },
        ],
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    leadQuotationSchema.plugin(softDeletePlugin);
    mongoose.model('LeadQuotation', leadQuotationSchema);
  }

  // TermsAndConditions schema
  if (!mongoose.models.TermsAndConditions) {
    const termsAndConditionsSchema = new mongoose.Schema(
      {
        title: { type: String, required: true, trim: true, index: true },
        code: { type: String, trim: true, lowercase: true },
        type: { type: String, enum: ['quotation', 'order', 'invoice', 'general'], default: 'general', index: true },
        description: { type: String, trim: true },
        is_active: { type: Boolean, default: true, index: true },
        is_default: { type: Boolean, default: false, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    mongoose.model('TermsAndConditions', termsAndConditionsSchema);
  }

  // TermsText schema
  if (!mongoose.models.TermsText) {
    const termsTextSchema = new mongoose.Schema(
      {
        terms_and_conditions_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TermsAndConditions', required: true, index: true },
        section_heading: { type: String, trim: true },
        text: { type: String, required: true, trim: true },
        sequence: { type: Number, default: 1 },
        sort_order: { type: Number, default: 0 },
        is_active: { type: Boolean, default: true, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    mongoose.model('TermsText', termsTextSchema);
  }

  // Product schema
  if (!mongoose.models.Product) {
    const productSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        product_name: { type: String, required: true, trim: true, index: true },
        generic_name: { type: String, trim: true },
        sku: { type: String, trim: true, uppercase: true, index: true },
        product_type: { type: String, default: 'individual' },
        unit: { type: String, default: 'pcs' },
        base_price: { type: Number, default: 0 },
        minimum_sale_rate: { type: Number, default: 0 },
        mrp: { type: Number, default: 0 },
        gst_percent: { type: Number, default: 18 },
        hsn_code: { type: String, trim: true },
        is_active: { type: Boolean, default: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true, strict: false }
    );
    productSchema.plugin(softDeletePlugin);
    mongoose.model('Product', productSchema);
  }

  // Order item schema
  const orderItemSchema = new mongoose.Schema(
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
      product_name: { type: String, required: true, trim: true },
      sku: String,
      brand: String,
      manufacturer: String,
      product_group: String,
      product_subgroup: String,
      unit: String,
      hsn_code: String,
      gst_percent: { type: Number, default: 18 },
      ordered_quantity: { type: Number, required: true, min: 1 },
      approved_quantity: { type: Number, default: 0 },
      dispatched_quantity: { type: Number, default: 0 },
      delivered_quantity: { type: Number, default: 0 },
      returned_quantity: { type: Number, default: 0 },
      line_status: { type: String, enum: ['active', 'fulfilled', 'cancelled'], default: 'active', index: true },
      free_quantity: { type: Number, default: 0 },
      unit_price: { type: Number, required: true, default: 0 },
      applied_rate_type: { type: String, enum: ['SR', 'SRA', 'CR', 'MANUAL'], default: 'SR' },
      discount_percent: { type: Number, default: 0 },
      discount_amount: { type: Number, default: 0 },
      taxable_amount: { type: Number, default: 0 },
      gst_amount: { type: Number, default: 0 },
      total_amount: { type: Number, default: 0 },
      remarks: String,
    },
    { _id: true, timestamps: true, strict: false }
  );

  // Order schema
  if (!mongoose.models.Order) {
    const orderSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        order_no: { type: String, required: true, unique: true, index: true },
        order_date: { type: Date, default: Date.now, index: true },
        expected_delivery_date: Date,
        priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
        party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', index: true },
        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', index: true },
        lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
        status: { type: String, default: 'submitted', index: true },
        lifecycle_status: { type: String, default: 'draft', index: true },
        workflow_stage: { type: String, default: 'sales', index: true },
        current_action: { type: String, default: 'submitted', index: true },
        current_revision: { type: Number, default: 1 },
        is_locked: { type: Boolean, default: false },
        current_assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        assigned_sales_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        current_department: { type: String, default: 'sales', index: true },
        pending_with_role: { type: String, default: 'sales', index: true },
        subtotal: { type: Number, default: 0 },
        discount_amount: { type: Number, default: 0 },
        taxable_amount: { type: Number, default: 0 },
        gst_amount: { type: Number, default: 0 },
        grand_total: { type: Number, default: 0 },
        extra_charges: { type: Number, default: 0 },
        penalty_amount: { type: Number, default: 0 },
        damage_charge: { type: Number, default: 0 },
        payment_status: { type: String, default: 'unpaid', index: true },
        billing_status: { type: String, default: 'unbilled', index: true },
        order_items: { type: [orderItemSchema], default: [] },
        remarks: String,
        internal_notes: String,
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true, strict: false }
    );
    orderSchema.plugin(softDeletePlugin);
    mongoose.model('Order', orderSchema);
  }

  // LeadReportingEdge schema — who reports to whom in lead_manager portal
  if (!mongoose.models.LeadReportingEdge) {
    const reportingEdgeSchema = new mongoose.Schema(
      {
        subordinate: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        manager: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        subordinate_role: {
          type: String,
          enum: ['executive', 'coordinator', 'manager'],
          required: true,
        },
        manager_role: {
          type: String,
          enum: ['coordinator', 'manager', 'admin'],
          required: true,
        },
        is_active: { type: Boolean, default: true, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    reportingEdgeSchema.index(
      { subordinate: 1, manager: 1 },
      { unique: true, partialFilterExpression: { is_active: true } }
    );
    mongoose.model('LeadReportingEdge', reportingEdgeSchema);
  }

  _cached = {
    User: mongoose.model('User'),
    CompanyInfo: mongoose.models.CompanyInfo || null,
    Party: mongoose.model('Party'),
    Attachment: mongoose.model('Attachment'),
    Notification: mongoose.model('Notification'),
    ActivityLog: mongoose.model('ActivityLog'),
    Lead: mongoose.model('Lead'),
    LeadFollowUp: mongoose.model('LeadFollowUp'),
    FollowUpDigestLog: mongoose.model('FollowUpDigestLog'),
    LeadQuotation: mongoose.model('LeadQuotation'),
    LeadSource: mongoose.model('LeadSource'),
    LeadLostReason: mongoose.model('LeadLostReason'),
    TermsAndConditions: mongoose.model('TermsAndConditions'),
    TermsText: mongoose.model('TermsText'),
    Product: mongoose.model('Product'),
    Order: mongoose.model('Order'),
    LeadReportingEdge: mongoose.model('LeadReportingEdge'),
  };

  return _cached;
}

function getModels() {
  if (_cached) return _cached;
  return registerModels();
}

module.exports = {
  registerModels,
  getModels,
};
