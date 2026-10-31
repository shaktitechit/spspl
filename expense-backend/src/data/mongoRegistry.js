/**
 * @fileoverview Registers mongoose models/schemas used by expense-backend.
 * @module data/mongoRegistry
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

let _cached = null;

function registerModels() {
  // CompanyInfo schema
  if (!mongoose.models.CompanyInfo) {
    const companyInfoSchema = new mongoose.Schema(
      {
        legal_name: { type: String, trim: true, default: '' },
        trade_name: { type: String, trim: true, default: '' },
        gstin: { type: String, trim: true, uppercase: true, default: '' },
        cin: { type: String, trim: true, uppercase: true, default: '' },
        pan: { type: String, trim: true, uppercase: true, default: '' },
        email: { type: String, lowercase: true, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        website: { type: String, trim: true, default: '' },
        logo_url: { type: String, trim: true, default: '' },
        primary_color: { type: String, trim: true, default: '#059669' },
        secondary_color: { type: String, trim: true, default: '#10b981' },
        address: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        state: { type: String, trim: true, default: '' },
        pincode: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' },
        is_default: { type: Boolean, default: true, index: true },
      },
      { timestamps: true }
    );
    mongoose.model('CompanyInfo', companyInfoSchema);
  }

  // User schema
  if (!mongoose.models.User) {
    const userSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        phone: { type: String, trim: true },
        department: { type: String, trim: true },
        roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
        portals: [
          {
            portal: { type: mongoose.Schema.Types.ObjectId, ref: 'Portal' },
            portal_code: { type: String, trim: true },
            access_roles: [{ type: String, trim: true }],
          },
        ],
        is_active: { type: Boolean, default: true },
      },
      { timestamps: true }
    );
    mongoose.model('User', userSchema);
  }

  // Party schema (minimal for vendor/client references)
  if (!mongoose.models.Party) {
    const partySchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        party_name: { type: String, required: true, trim: true },
        legal_name: { type: String, trim: true },
        party_type: { type: String, default: 'vendor', trim: true, index: true },
        contact_person: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, lowercase: true, trim: true },
        gstin: { type: String, trim: true, uppercase: true },
        pan: { type: String, trim: true, uppercase: true },
        is_active: { type: Boolean, default: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    partySchema.plugin(softDeletePlugin);
    mongoose.model('Party', partySchema);
  }

  // Attachment schema (for receipts, invoices, odometer photos, disbursement proofs, vouchers)
  if (!mongoose.models.Attachment) {
    const attachmentSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        file_name: { type: String, required: true, trim: true },
        original_name: { type: String, trim: true },
        mime_type: { type: String, trim: true },
        file_size: { type: Number, min: 0 },
        storage_path: { type: String, required: true, trim: true },
        public_url: { type: String, trim: true },
        resource_type: { type: String, trim: true, index: true },
        resource_id: { type: mongoose.Schema.Types.ObjectId, index: true },
        uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    mongoose.model('Attachment', attachmentSchema);
  }

  // Notification schema
  if (!mongoose.models.Notification) {
    const notificationSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        type: { type: String, default: 'info', trim: true },
        link: { type: String, trim: true },
        is_read: { type: Boolean, default: false, index: true },
        read_at: Date,
        metadata: { type: mongoose.Schema.Types.Mixed },
      },
      { timestamps: true }
    );
    mongoose.model('Notification', notificationSchema);
  }

  // ActivityLog schema
  if (!mongoose.models.ActivityLog) {
    const activityLogSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        actor_name: String,
        action: { type: String, required: true, trim: true },
        target_entity: { type: String, required: true, trim: true },
        target_id: { type: mongoose.Schema.Types.ObjectId, index: true },
        details: { type: mongoose.Schema.Types.Mixed },
        ip_address: String,
        user_agent: String,
      },
      { timestamps: true }
    );
    mongoose.model('ActivityLog', activityLogSchema);
  }

  // WorkPlan minimal schema (stub for backward compatibility when querying existing expenses)
  if (!mongoose.models.WorkPlan) {
    const workPlanSchema = new mongoose.Schema(
      {
        plan_date: { type: Date, index: true },
        sales_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        status: { type: String, index: true },
        remarks: { type: String, trim: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    workPlanSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlan', workPlanSchema);
  }

  // WorkPlanExpense / Expense schema
  const EXPENSE_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];
  const EXPENSE_CATEGORIES = [
    'Travel',
    'Accommodation',
    'Food',
    'Communication',
    'Client Entertainment',
    'Marketing',
    'Office',
    'Miscellaneous',
  ];
  const EXPENSE_PAYMENT_MODES = [
    'Cash',
    'UPI',
    'Card',
    'Bank Transfer',
    'Company Card',
  ];

  if (!mongoose.models.WorkPlanExpense) {
    const workPlanExpenseSchema = new mongoose.Schema(
      {
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          default: null,
          index: true,
        },
        work_plan_visit: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
          index: true,
        },
        expense_date: { type: Date, required: true, index: true },
        category: {
          type: String,
          enum: EXPENSE_CATEGORIES,
          required: true,
          index: true,
        },
        sub_category: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0 },
        payment_mode: {
          type: String,
          enum: EXPENSE_PAYMENT_MODES,
          required: true,
          default: 'Cash',
        },
        vendor_name: { type: String, trim: true },
        bill_number: { type: String, trim: true },
        bill_date: Date,
        description: { type: String, trim: true },
        receipt_attachment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attachment',
          default: null,
        },
        attachments: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attachment',
          },
        ],
        start_reading: { type: Number, min: 0 },
        closing_reading: { type: Number, min: 0 },
        total_km: { type: Number, min: 0 },
        rate_per_km: { type: Number, default: 3.5 },
        start_reading_image: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attachment',
          default: null,
        },
        end_reading_image: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attachment',
          default: null,
        },
        status: {
          type: String,
          enum: EXPENSE_STATUSES,
          default: 'submitted',
          index: true,
        },
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approved_at: Date,
        rejection_reason: { type: String, trim: true },
        manager_remarks: { type: String, trim: true },
        settled_amount: { type: Number, default: 0, min: 0 },
        settlement_status: {
          type: String,
          enum: ['unsettled', 'partially_settled', 'settled'],
          default: 'unsettled',
          index: true,
        },
        settlement_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlanExpenseSettlement',
          default: null,
          index: true,
        },
        deletedAt: { type: Date, default: null, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    workPlanExpenseSchema.index({ sales_user: 1, status: 1, deletedAt: 1 });
    workPlanExpenseSchema.index({ sales_user: 1, settlement_status: 1, deletedAt: 1 });
    workPlanExpenseSchema.index({ status: 1, settlement_status: 1, deletedAt: 1 });
    workPlanExpenseSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanExpense', workPlanExpenseSchema);
  }

  // WorkPlanTourAdvance / TourAdvance schema
  const TOUR_ADVANCE_STATUSES = [
    'pending',
    'approved',
    'rejected',
    'disbursed',
    'settled',
    'recovered',
    'refunded',
  ];

  if (!mongoose.models.WorkPlanTourAdvance) {
    const tourAdvanceSchema = new mongoose.Schema(
      {
        advance_number: {
          type: String,
          required: true,
          unique: true,
          trim: true,
          index: true,
        },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          default: null,
          index: true,
        },
        request_date: {
          type: Date,
          required: true,
          default: Date.now,
          index: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 1,
        },
        purpose: {
          type: String,
          required: true,
          trim: true,
        },
        notes: {
          type: String,
          trim: true,
        },
        status: {
          type: String,
          enum: TOUR_ADVANCE_STATUSES,
          default: 'pending',
          index: true,
        },
        approved_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        approved_at: Date,
        rejection_reason: {
          type: String,
          trim: true,
        },
        disbursed_amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        disbursed_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        disbursed_at: Date,
        payment_method: {
          type: String,
          trim: true,
          default: 'Bank Transfer',
        },
        transaction_reference: {
          type: String,
          trim: true,
        },
        bank_name: {
          type: String,
          trim: true,
        },
        disbursement_notes: {
          type: String,
          trim: true,
        },
        remaining_balance: {
          type: Number,
          default: 0,
          min: 0,
        },
        settled_amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        refunded_amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        refunded_at: Date,
        refunded_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        refund_notes: {
          type: String,
          trim: true,
        },
        refund_reference: {
          type: String,
          trim: true,
        },
        attachments: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attachment',
          },
        ],
        deletedAt: {
          type: Date,
          default: null,
          index: true,
        },
        created_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        updated_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
      { timestamps: true }
    );
    tourAdvanceSchema.index({ sales_user: 1, status: 1, deletedAt: 1 });
    tourAdvanceSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanTourAdvance', tourAdvanceSchema);
  }

  // WorkPlanExpenseSettlement / ExpenseSettlement schema
  if (!mongoose.models.WorkPlanExpenseSettlement) {
    const expenseSettlementSchema = new mongoose.Schema(
      {
        settlement_number: {
          type: String,
          required: true,
          unique: true,
          trim: true,
          index: true,
        },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        settlement_date: {
          type: Date,
          required: true,
          default: Date.now,
          index: true,
        },
        claims: [
          {
            expense: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'WorkPlanExpense',
              required: true,
            },
            amount: {
              type: Number,
              required: true,
              min: 0,
            },
            category: String,
            description: String,
            expense_date: Date,
          },
        ],
        advances: [
          {
            advance: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'WorkPlanTourAdvance',
              required: true,
            },
            deducted_amount: {
              type: Number,
              required: true,
              min: 0,
            },
            advance_number: String,
          },
        ],
        total_claim_amount: {
          type: Number,
          required: true,
          min: 0,
        },
        advance_deduction_amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        direct_payment_amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        settlement_mode: {
          type: String,
          enum: ['advance_deduction', 'direct_payment', 'split'],
          required: true,
          default: 'direct_payment',
        },
        payment_method: {
          type: String,
          trim: true,
          default: 'Bank Transfer',
        },
        transaction_reference: {
          type: String,
          trim: true,
        },
        bank_name: {
          type: String,
          trim: true,
        },
        settlement_notes: {
          type: String,
          trim: true,
        },
        attachments: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attachment',
          },
        ],
        settled_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        deletedAt: {
          type: Date,
          default: null,
          index: true,
        },
      },
      { timestamps: true }
    );
    expenseSettlementSchema.index({ sales_user: 1, settlement_date: -1, deletedAt: 1 });
    expenseSettlementSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanExpenseSettlement', expenseSettlementSchema);
  }

  _cached = {
    User: mongoose.model('User'),
    CompanyInfo: mongoose.models.CompanyInfo || null,
    Party: mongoose.model('Party'),
    Attachment: mongoose.model('Attachment'),
    Notification: mongoose.model('Notification'),
    ActivityLog: mongoose.model('ActivityLog'),
    WorkPlan: mongoose.model('WorkPlan'),
    WorkPlanExpense: mongoose.model('WorkPlanExpense'),
    Expense: mongoose.model('WorkPlanExpense'),
    WorkPlanTourAdvance: mongoose.model('WorkPlanTourAdvance'),
    TourAdvance: mongoose.model('WorkPlanTourAdvance'),
    WorkPlanExpenseSettlement: mongoose.model('WorkPlanExpenseSettlement'),
    ExpenseSettlement: mongoose.model('WorkPlanExpenseSettlement'),
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
