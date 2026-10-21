/**
 * @fileoverview Registers all mongoose models/schemas used by work-planner-backend.
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
        primary_color: { type: String, trim: true, default: '#4f46e5' },
        secondary_color: { type: String, trim: true, default: '#3b82f6' },
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

  // Party schema
  if (!mongoose.models.Party) {
    const partyAddressSchema = new mongoose.Schema(
      {
        address_line_1: String,
        address_line_2: String,
        city: String,
        state: String,
        pincode: String,
        country: { type: String, default: 'India' },
      },
      { _id: false }
    );

    const partyContactSchema = new mongoose.Schema(
      {
        name: { type: String, trim: true },
        department: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, lowercase: true, trim: true },
        alternate_phone: { type: String, trim: true },
        designation: { type: String, trim: true },
      },
      { _id: false }
    );

    const partySchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        party_name: { type: String, required: true, trim: true },
        legal_name: { type: String, trim: true },
        party_type: {
          type: String,
          enum: ['customer', 'supplier', 'both', 'leads', 'lead', 'quotation', 'quotations', 'visits', 'visit'],
          default: 'visits',
          trim: true,
          index: true,
        },
        contact_person: { type: String, trim: true },
        mobile: { type: String, trim: true },
        email: { type: String, lowercase: true, trim: true },
        contacts: { type: [partyContactSchema], default: [] },
        gst_no: { type: String, uppercase: true, trim: true },
        drug_license_no: { type: String, trim: true },
        billing_address: partyAddressSchema,
        shipping_address: partyAddressSchema,
        city: { type: String, trim: true },
        district: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true },
        country_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCountry', index: true },
        state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyState', index: true },
        city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCity', index: true },
        is_active: { type: Boolean, default: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true, strict: false }
    );
    partySchema.plugin(softDeletePlugin);
    mongoose.model('Party', partySchema);
  }

  // Attachment schema
  if (!mongoose.models.Attachment) {
    const attachmentSchema = new mongoose.Schema(
      {
        filename: { type: String, required: true },
        original_name: { type: String, required: true },
        mime_type: { type: String, required: true },
        size: { type: Number, required: true },
        storage_path: { type: String, required: true },
        url: { type: String },
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
        module: { type: String, default: 'work_planner' },
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

  // WorkPlan schema
  const WORK_PLAN_STATUSES = ['planned', 'draft', 'submitted', 'approved', 'rejected', 'completed'];
  if (!mongoose.models.WorkPlan) {
    const workPlanSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        plan_date: { type: Date, required: true, index: true },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        status: {
          type: String,
          enum: WORK_PLAN_STATUSES,
          default: 'planned',
          index: true,
        },
        plan_type: {
          type: String,
          enum: ['Visits', 'Tasks & Visits', 'Leave', 'Work From Home', 'Work From Office'],
          default: 'Visits',
          index: true,
        },
        remarks: { type: String, trim: true },
        location: { type: String, trim: true },
        country_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCountry', index: true },
        state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyState', index: true },
        city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCity', index: true },
        city_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PartyCity' }],
        country: { type: String, trim: true },
        state: { type: String, trim: true },
        city: { type: String, trim: true },
        cities: [{ type: String, trim: true }],
        is_discussed_with_manager: { type: Boolean, default: false },
        discussed_manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        discussed_manager_name: { type: String, trim: true },
        discussion_method: {
          type: String,
          enum: ['on_call', 'on_direct_meeting', 'on_email', 'other'],
        },
        submitted_at: Date,
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approved_at: Date,
        rejection_reason: { type: String, trim: true },
        manager_remarks: { type: String, trim: true },
        authority_remarks: [
          {
            remark: { type: String, required: true, trim: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            user_name: { type: String, trim: true },
            role: { type: String, trim: true },
            remark_type: {
              type: String,
              enum: ['instruction', 'appreciation', 'objection'],
              default: 'instruction',
            },
            priority: {
              type: String,
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
            expected_followup_date: Date,
            status: {
              type: String,
              enum: ['pending_response', 'responded', 'resolved'],
              default: 'pending_response',
            },
            followup_remarks: [
              {
                response: { type: String, required: true, trim: true },
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                user_name: { type: String, trim: true },
                role: { type: String, trim: true },
                action_status: {
                  type: String,
                  enum: ['in_progress', 'completed', 'clarification_provided', 'need_help', 'acknowledged'],
                  default: 'completed',
                },
                attachments: [
                  {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Attachment',
                  },
                ],
                attachment_details: [
                  {
                    attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
                    filename: { type: String, trim: true },
                    original_name: { type: String, trim: true },
                    mime_type: { type: String, trim: true },
                    size: { type: Number },
                    url: { type: String, trim: true },
                  },
                ],
                created_at: { type: Date, default: Date.now },
              },
            ],
            resolution_remarks: { type: String, trim: true },
            resolved_at: Date,
            resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            resolved_by_name: { type: String, trim: true },
            created_at: { type: Date, default: Date.now },
          },
        ],
        day_end: {
          completed_at: Date,
          from_email: { type: String, trim: true },
          to_email: { type: String, trim: true },
          cc_emails: [{ type: String, trim: true }],
          subject: { type: String, trim: true },
          body_html: { type: String },
          attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
        },
        deletedAt: { type: Date, default: null, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    workPlanSchema.index(
      { sales_user: 1, plan_date: 1 },
      {
        unique: true,
        partialFilterExpression: { deletedAt: null },
      }
    );
    workPlanSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlan', workPlanSchema);
  }

  // WorkPlanVisit schema
  const WORK_PLAN_VISIT_STATUSES = [
    'created',
    'pending',
    'in_progress',
    'checked_in',
    'checked_out',
    'completed',
    'cancelled',
    'skipped',
    'rescheduled',
  ];
  if (!mongoose.models.WorkPlanVisit) {
    const workPlanVisitSchema = new mongoose.Schema(
      {
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          required: false,
          default: null,
          index: true,
        },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: false,
          index: true,
        },
        plan_date: {
          type: Date,
          required: false,
          index: true,
        },
        sequence: { type: Number, required: true, min: 1, default: 1 },
        party_type: {
          type: String,
          enum: ['existing', 'new_party', 'new_lead', 'existing_lead', 'facility', 'enquiry'],
          default: 'existing',
          index: true,
        },
        party: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Party',
          required: false,
          index: true,
        },
        party_name: { type: String, trim: true },
        contact_person: { type: String, trim: true },
        contact_number: { type: String, trim: true },
        contact_email: { type: String, trim: true, lowercase: true },
        contacts: [
          {
            contact_person: { type: String, trim: true },
            contact_number: { type: String, trim: true },
            contact_email: { type: String, trim: true, lowercase: true },
          },
        ],
        address: { type: String, trim: true },
        country: { type: String, trim: true },
        state: { type: String, trim: true },
        city: { type: String, trim: true },
        country_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCountry' },
        state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyState' },
        city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCity' },
        gst_no: { type: String, trim: true, uppercase: true },
        planned_start_time: Date,
        planned_end_time: Date,
        purpose: { type: String, trim: true },
        notes: { type: String, trim: true },
        status: {
          type: String,
          enum: WORK_PLAN_VISIT_STATUSES,
          default: 'created',
          index: true,
        },
        pending_remarks: { type: String, trim: true },
        in_progress_remarks: { type: String, trim: true },
        manager_remarks: { type: String, trim: true },
        authority_remarks: [
          {
            remark: { type: String, required: true, trim: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            user_name: { type: String, trim: true },
            role: { type: String, trim: true },
            remark_type: {
              type: String,
              enum: ['instruction', 'appreciation', 'objection'],
              default: 'instruction',
            },
            priority: {
              type: String,
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
            expected_followup_date: Date,
            status: {
              type: String,
              enum: ['pending_response', 'responded', 'resolved'],
              default: 'pending_response',
            },
            followup_remarks: [
              {
                response: { type: String, required: true, trim: true },
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                user_name: { type: String, trim: true },
                role: { type: String, trim: true },
                action_status: {
                  type: String,
                  enum: ['in_progress', 'completed', 'clarification_provided', 'need_help', 'acknowledged'],
                  default: 'completed',
                },
                attachments: [
                  {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Attachment',
                  },
                ],
                attachment_details: [
                  {
                    attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
                    filename: { type: String, trim: true },
                    original_name: { type: String, trim: true },
                    mime_type: { type: String, trim: true },
                    size: { type: Number },
                    url: { type: String, trim: true },
                  },
                ],
                created_at: { type: Date, default: Date.now },
              },
            ],
            resolution_remarks: { type: String, trim: true },
            resolved_at: Date,
            resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            resolved_by_name: { type: String, trim: true },
            created_at: { type: Date, default: Date.now },
          },
        ],
        created_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        created_by_role: { type: String, trim: true },
        updated_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        updated_by_role: { type: String, trim: true },
        actual_check_in: Date,
        actual_check_out: Date,
        check_in_selfie_url: { type: String, trim: true },
        check_out_selfie_url: { type: String, trim: true },
        outcome_selfie_url: { type: String, trim: true },
        check_in_lat: { type: Number },
        check_in_lng: { type: Number },
        check_in_address: { type: String, trim: true },
        check_out_lat: { type: Number },
        check_out_lng: { type: Number },
        check_out_address: { type: String, trim: true },
        outcome: { type: String, trim: true },
        meeting_with_doctor: { type: Boolean },
        meeting_with_purchase: { type: Boolean },
        meeting_with_finance: { type: Boolean },
        meeting_with_engineer: { type: Boolean },
        new_product_introduced: { type: Boolean },
        order_received: { type: Boolean },
        next_followup_date: Date,
        rescheduled_date: Date,
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    workPlanVisitSchema.index(
      { work_plan: 1, sequence: 1 },
      {
        unique: true,
        partialFilterExpression: { work_plan: { $type: 'objectId' }, deletedAt: null },
      }
    );
    workPlanVisitSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanVisit', workPlanVisitSchema);
  }

  // WorkPlanWork schema
  if (!mongoose.models.WorkPlanWork) {
    const workPlanWorkSchema = new mongoose.Schema(
      {
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          required: false,
          default: null,
          index: true,
        },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: false,
          index: true,
        },
        plan_date: {
          type: Date,
          required: false,
          index: true,
        },
        sequence: { type: Number, required: true, min: 1, default: 1 },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        planned_start_time: Date,
        planned_end_time: Date,
        status: {
          type: String,
          enum: ['created', 'pending', 'in_progress', 'completed', 'cancelled', 'skipped', 'rescheduled'],
          default: 'created',
          index: true,
        },
        completion_remarks: { type: String, trim: true },
        pending_remarks: { type: String, trim: true },
        in_progress_remarks: { type: String, trim: true },
        manager_remarks: { type: String, trim: true },
        rescheduled_date: Date,
        authority_remarks: [
          {
            remark: { type: String, required: true, trim: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            user_name: { type: String, trim: true },
            role: { type: String, trim: true },
            remark_type: {
              type: String,
              enum: ['instruction', 'appreciation', 'objection'],
              default: 'instruction',
            },
            priority: {
              type: String,
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
            expected_followup_date: Date,
            status: {
              type: String,
              enum: ['pending_response', 'responded', 'resolved'],
              default: 'pending_response',
            },
            followup_remarks: [
              {
                response: { type: String, required: true, trim: true },
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                user_name: { type: String, trim: true },
                role: { type: String, trim: true },
                action_status: {
                  type: String,
                  enum: ['in_progress', 'completed', 'clarification_provided', 'need_help', 'acknowledged'],
                  default: 'completed',
                },
                attachments: [
                  {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Attachment',
                  },
                ],
                attachment_details: [
                  {
                    attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
                    filename: { type: String, trim: true },
                    original_name: { type: String, trim: true },
                    mime_type: { type: String, trim: true },
                    size: { type: Number },
                    url: { type: String, trim: true },
                  },
                ],
                created_at: { type: Date, default: Date.now },
              },
            ],
            resolution_remarks: { type: String, trim: true },
            resolved_at: Date,
            resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            resolved_by_name: { type: String, trim: true },
            created_at: { type: Date, default: Date.now },
          },
        ],
        created_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        created_by_role: { type: String, trim: true },
        updated_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        updated_by_role: { type: String, trim: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    workPlanWorkSchema.index(
      { work_plan: 1, sequence: 1 },
      {
        unique: true,
        partialFilterExpression: { work_plan: { $type: 'objectId' }, deletedAt: null },
      }
    );
    workPlanWorkSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanWork', workPlanWorkSchema);
  }

  // WorkPlanExpense schema
  const WORK_PLAN_EXPENSE_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];
  const WORK_PLAN_EXPENSE_CATEGORIES = [
    'Travel',
    'Accommodation',
    'Food',
    'Communication',
    'Client Entertainment',
    'Marketing',
    'Office',
    'Miscellaneous',
  ];
  const WORK_PLAN_EXPENSE_PAYMENT_MODES = [
    'Cash',
    'UPI',
    'Card',
    'Bank Transfer',
    'Company Card',
  ];

  if (!mongoose.models.WorkPlanExpense) {
    const workPlanExpenseSchema = new mongoose.Schema(
      {
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          required: true,
          index: true,
        },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: false,
          index: true,
        },
        work_plan_visit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlanVisit',
          default: null,
          index: true,
        },
        expense_date: { type: Date, required: true, index: true },
        category: {
          type: String,
          enum: WORK_PLAN_EXPENSE_CATEGORIES,
          required: true,
          index: true,
        },
        sub_category: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0 },
        payment_mode: {
          type: String,
          enum: WORK_PLAN_EXPENSE_PAYMENT_MODES,
          required: true,
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
          enum: WORK_PLAN_EXPENSE_STATUSES,
          default: 'draft',
          index: true,
        },
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approved_at: Date,
        rejection_reason: { type: String, trim: true },
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
        authority_remarks: [
          {
            remark: { type: String, required: true, trim: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            user_name: { type: String, trim: true },
            role: { type: String, trim: true },
            remark_type: {
              type: String,
              enum: ['instruction', 'appreciation', 'objection'],
              default: 'instruction',
            },
            priority: {
              type: String,
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
            expected_followup_date: Date,
            status: {
              type: String,
              enum: ['pending_response', 'responded', 'resolved'],
              default: 'pending_response',
            },
            followup_remarks: [
              {
                response: { type: String, required: true, trim: true },
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                user_name: { type: String, trim: true },
                role: { type: String, trim: true },
                action_status: {
                  type: String,
                  enum: ['in_progress', 'completed', 'clarification_provided', 'need_help', 'acknowledged'],
                  default: 'completed',
                },
                attachments: [
                  {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Attachment',
                  },
                ],
                attachment_details: [
                  {
                    attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
                    filename: { type: String, trim: true },
                    original_name: { type: String, trim: true },
                    mime_type: { type: String, trim: true },
                    size: { type: Number },
                    url: { type: String, trim: true },
                  },
                ],
                created_at: { type: Date, default: Date.now },
              },
            ],
            resolution_remarks: { type: String, trim: true },
            resolved_at: Date,
            resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            resolved_by_name: { type: String, trim: true },
            created_at: { type: Date, default: Date.now },
          },
        ],
        deletedAt: { type: Date, default: null, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    workPlanExpenseSchema.index({ work_plan: 1, status: 1, deletedAt: 1 });
    workPlanExpenseSchema.index({ sales_user: 1, settlement_status: 1, deletedAt: 1 });
    workPlanExpenseSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanExpense', workPlanExpenseSchema);
  }

  // WorkPlanTourAdvance schema
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
          enum: ['pending', 'approved', 'rejected', 'disbursed', 'settled', 'recovered', 'refunded'],
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
        settled_amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        remaining_balance: {
          type: Number,
          default: 0,
          min: 0,
        },
        refunded_amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        attachments: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attachment',
          },
        ],
        attachment_details: [
          {
            attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
            filename: { type: String, trim: true },
            original_name: { type: String, trim: true },
            mime_type: { type: String, trim: true },
            size: { type: Number },
            url: { type: String, trim: true },
          },
        ],
        disbursement_attachments: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Attachment',
          },
        ],
        disbursement_attachment_details: [
          {
            attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
            filename: { type: String, trim: true },
            original_name: { type: String, trim: true },
            mime_type: { type: String, trim: true },
            size: { type: Number },
            url: { type: String, trim: true },
          },
        ],
        refunds: [
          {
            amount: { type: Number, required: true, min: 0.01 },
            refund_date: { type: Date, default: Date.now },
            payment_method: { type: String, default: 'UPI' },
            transaction_reference: { type: String, trim: true },
            notes: { type: String, trim: true },
            attachments: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Attachment',
              },
            ],
            attachment_details: [
              {
                attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
                filename: { type: String, trim: true },
                original_name: { type: String, trim: true },
                mime_type: { type: String, trim: true },
                size: { type: Number },
                url: { type: String, trim: true },
              },
            ],
            accepted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            accepted_at: { type: Date, default: Date.now },
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
    tourAdvanceSchema.index({ request_date: -1, deletedAt: 1 });
    tourAdvanceSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanTourAdvance', tourAdvanceSchema);
  }

  // WorkPlanExpenseSettlement schema
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
        attachment_details: [
          {
            attachment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
            filename: { type: String, trim: true },
            original_name: { type: String, trim: true },
            mime_type: { type: String, trim: true },
            size: { type: Number },
            url: { type: String, trim: true },
          },
        ],
        settled_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        settled_at: {
          type: Date,
          default: Date.now,
        },
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
    expenseSettlementSchema.index({ sales_user: 1, settlement_date: -1, deletedAt: 1 });
    expenseSettlementSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanExpenseSettlement', expenseSettlementSchema);
  }

  // UserWorkPlannerSettings schema
  if (!mongoose.models.UserWorkPlannerSettings) {
    const userWorkPlannerSettingsSchema = require('../models/UserWorkPlannerSettings');
    mongoose.model('UserWorkPlannerSettings', userWorkPlannerSettingsSchema);
  }

  // UserTaskCatalog schema (custom task definitions & templates per user)
  if (!mongoose.models.UserTaskCatalog) {
    const userTaskCatalogSchema = require('../models/UserTaskCatalog');
    mongoose.model('UserTaskCatalog', userTaskCatalogSchema);
  }

  // UserVisitTemplate schema (single visit planning & outcome template per user)
  if (!mongoose.models.UserVisitTemplate) {
    const userVisitTemplateSchema = require('../models/UserVisitTemplate');
    mongoose.model('UserVisitTemplate', userVisitTemplateSchema);
  }

  // WorkPlannerReportingEdge — who reports to whom (executive→manager, manager→admin)
  if (!mongoose.models.WorkPlannerReportingEdge) {
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
    mongoose.model('WorkPlannerReportingEdge', reportingEdgeSchema);
  }

  // WorkPlanAnalyticsCache schema (stores 360° AI assessment and aggregated metrics)
  if (!mongoose.models.WorkPlanAnalyticsCache) {
    const analyticsCacheSchema = new mongoose.Schema(
      {
        sales_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkPlan', default: null, index: true },
        from_date: { type: Date, required: true },
        to_date: { type: Date, required: true },
        scope_key: { type: String, required: true, index: true },
        metrics_snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
        ai_assessment: { type: mongoose.Schema.Types.Mixed, required: true },
        generated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        expires_at: { type: Date, index: { expires: 0 } },
      },
      { timestamps: true }
    );
    analyticsCacheSchema.index({ sales_user: 1, scope_key: 1 });
    mongoose.model('WorkPlanAnalyticsCache', analyticsCacheSchema);
  }

  // WorkPlanDraft schema (stores real-time cloud running drafts for resilient multi-device sync)
  if (!mongoose.models.WorkPlanDraft) {
    const workPlanDraftSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        plan_date: { type: Date, required: true, index: true },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        plan_type: { type: String, trim: true },
        remarks: { type: String, trim: true },
        location: { type: String, trim: true },
        country_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCountry' },
        state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyState' },
        city_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyCity' },
        country: { type: String, trim: true },
        state: { type: String, trim: true },
        city: { type: String, trim: true },
        is_discussed_with_manager: { type: Boolean, default: null },
        discussed_manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        discussed_manager_name: { type: String, trim: true },
        discussion_method: {
          type: String,
          enum: ['on_call', 'on_direct_meeting', 'on_email', 'other'],
        },
        visits: {
          type: [mongoose.Schema.Types.Mixed],
          default: [],
        },
        works: {
          type: [mongoose.Schema.Types.Mixed],
          default: [],
        },
        last_saved_at: { type: Date, default: Date.now },
      },
      { timestamps: true }
    );
    workPlanDraftSchema.index({ sales_user: 1, plan_date: 1 }, { unique: true });
    mongoose.model('WorkPlanDraft', workPlanDraftSchema);
  }

  // Project management schemas
  if (!mongoose.models.Project) {
    require('../models/Project');
  }
  if (!mongoose.models.ProjectActionStep) {
    require('../models/ProjectActionStep');
  }
  if (!mongoose.models.ProjectMessage) {
    require('../models/ProjectMessage');
  }
  if (!mongoose.models.ProjectFile) {
    require('../models/ProjectFile');
  }
  if (!mongoose.models.UserNote) {
    require('../models/UserNote');
  }
  if (!mongoose.models.HelpTicket) {
    require('../models/HelpTicket');
  }
  if (!mongoose.models.HelpTicketReply) {
    require('../models/HelpTicketReply');
  }
  if (!mongoose.models.UserEmailPreference) {
    const { userEmailPreferenceSchema } = require('../models/UserEmailPreference');
    mongoose.model('UserEmailPreference', userEmailPreferenceSchema);
  }

  _cached = {
    User: mongoose.model('User'),
    CompanyInfo: mongoose.models.CompanyInfo || null,
    Party: mongoose.model('Party'),
    Attachment: mongoose.model('Attachment'),
    Notification: mongoose.model('Notification'),
    ActivityLog: mongoose.model('ActivityLog'),
    WorkPlan: mongoose.model('WorkPlan'),
    WorkPlanDraft: mongoose.model('WorkPlanDraft'),
    WorkPlanVisit: mongoose.model('WorkPlanVisit'),
    WorkPlanWork: mongoose.model('WorkPlanWork'),
    WorkPlanExpense: mongoose.model('WorkPlanExpense'),
    WorkPlanTourAdvance: mongoose.model('WorkPlanTourAdvance'),
    WorkPlanExpenseSettlement: mongoose.model('WorkPlanExpenseSettlement'),
    UserNote: mongoose.model('UserNote'),
    HelpTicket: mongoose.model('HelpTicket'),
    HelpTicketReply: mongoose.model('HelpTicketReply'),
    UserWorkPlannerSettings: mongoose.model('UserWorkPlannerSettings'),
    UserTaskCatalog: mongoose.model('UserTaskCatalog'),
    UserVisitTemplate: mongoose.model('UserVisitTemplate'),
    UserEmailPreference: mongoose.model('UserEmailPreference'),
    WorkPlannerReportingEdge: mongoose.model('WorkPlannerReportingEdge'),
    WorkPlanAnalyticsCache: mongoose.model('WorkPlanAnalyticsCache'),
    Project: mongoose.model('Project'),
    ProjectActionStep: mongoose.model('ProjectActionStep'),
    ProjectMessage: mongoose.model('ProjectMessage'),
    ProjectFile: mongoose.model('ProjectFile'),
  };

  return _cached;
}

async function fixWorkPlanIndexes() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    for (const colName of ['workplanvisits', 'workplanworks']) {
      try {
        const col = db.collection(colName);
        const indexes = await col.indexes();
        const dupIdx = indexes.find((idx) => idx.name === 'work_plan_1_sequence_1');
        if (dupIdx) {
          const pfe = dupIdx.partialFilterExpression;
          const isCorrect =
            pfe &&
            pfe.work_plan &&
            pfe.work_plan.$type === 'objectId' &&
            pfe.deletedAt === null;
          if (!isCorrect) {
            await col.dropIndex('work_plan_1_sequence_1');
          }
        }
      } catch (e) {
        // collection or index might not exist yet, safe to ignore
      }
    }

    // Clean up legacy single-manager unique index on workplannerreportingedges
    try {
      const edgeCol = db.collection('workplannerreportingedges');
      const edgeIndexes = await edgeCol.indexes();
      const oldSubIdx = edgeIndexes.find((idx) => idx.name === 'subordinate_1');
      if (oldSubIdx) {
        await edgeCol.dropIndex('subordinate_1');
      }
    } catch (e) {
      // safe to ignore
    }
  } catch (err) {
    // safe to ignore
  }
}

function getModels() {
  if (_cached) return _cached;
  return registerModels();
}

module.exports = {
  registerModels,
  getModels,
  fixWorkPlanIndexes,
};
