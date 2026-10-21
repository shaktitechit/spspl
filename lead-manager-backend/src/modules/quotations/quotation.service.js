/**
 * @fileoverview Quotation Service - Generates, lists, updates, and deletes quotations.
 * @module modules/quotations/quotation.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');
const emailHelper = require('../messages/helpers/email.helper');
const notificationHelper = require('../../utils/notificationHelper');
const microsoftGraph = require('../../config/microsoftGraph');
const { logger } = require('../../utils/logger');
const {
  isAdmin,
  isManager,
  isCoordinator,
  isExecutive,
  isLeadManagerElevated,
} = require('../../middlewares/leadManagerAuth.middleware');
const { getVisibleLeadUserIds, asObjectId } = require('../team/teamVisibility.service');
const authService = require('../../services/authService');
const { generateOrderNo } = require('../../utils/generateOrderNo');
const { resolveSalesRepFromQuotation } = require('../../utils/followUpSalesRep');
const {
  ACTIVE_PIPELINE_STATUSES,
  isActivePipelineStatus,
} = require('./quotation.constants');
const { computeQuotationLineAmounts } = require('./quotationLineMath');

const TEMPLATE_APPROVAL_REQUEST = 'lead_quotation_approval_request';
const TEMPLATE_APPROVED = 'lead_quotation_approved';
const TEMPLATE_REJECTED = 'lead_quotation_rejected';

/**
 * Checks whether user has permission to manage quotations (Admin portal role).
 */
function isQuotationManager(user) {
  return isLeadManagerElevated(user);
}

function isQuotationCreator(user, quotation) {
  if (!user || !quotation) return false;
  const creatorId = userIdOf(quotation.created_by);
  return Boolean(creatorId && String(creatorId) === String(user._id));
}

function isQuotationSalesPerson(user, quotation) {
  if (!user || !quotation) return false;
  const spId = userIdOf(quotation.sales_person_user);
  if (spId && String(spId) === String(user._id)) return true;
  const spEmail = String(quotation.sales_person_email || '')
    .toLowerCase()
    .trim();
  const userEmail = String(user.email || '')
    .toLowerCase()
    .trim();
  return Boolean(spEmail && userEmail && spEmail === userEmail);
}

/** Pipeline actions (status, submit for approval) for reps and managers on their quotes. */
function canActOnQuotationPipeline(user, quotation) {
  return (
    isQuotationManager(user) ||
    isQuotationCreator(user, quotation) ||
    isQuotationSalesPerson(user, quotation)
  );
}

function userIdOf(ref) {
  if (!ref) return null;
  if (typeof ref === 'object' && ref._id) return String(ref._id);
  return String(ref);
}

function formatGrandTotal(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function quotationCommonParams(quotation, extras = {}) {
  return {
    quotationNo: quotation.quotation_no || '',
    refNo: quotation.ref_no || 'N/A',
    customerName: quotation.customer_name || 'Customer',
    quotationSubject: quotation.subject || 'Quotation Proposal',
    grandTotal: formatGrandTotal(quotation.grand_total),
    salesPersonName: resolveSalesRepFromQuotation(quotation),
    ...extras,
  };
}

/**
 * Best-effort email (message-service template) + in-app notification.
 * Does not throw — approval actions must succeed even if alerts fail.
 */
async function notifyQuotationStakeholders({
  quotation,
  recipientEmail,
  recipientUserId,
  recipientName,
  actorUserId,
  templateName,
  templateParams,
  notificationTitle,
  notificationMessage,
  notificationType = 'info',
}) {
  const actorId = actorUserId ? String(actorUserId) : null;
  const notifyUserId = recipientUserId ? String(recipientUserId) : null;

  // Avoid self-noise when actor is also the recipient (e.g. creator == signatory).
  const skipSelf = actorId && notifyUserId && actorId === notifyUserId;

  if (recipientEmail && !skipSelf) {
    try {
      await emailHelper.sendTemplateEmail(
        recipientEmail,
        templateName,
        templateParams,
        [],
        [],
        microsoftGraph.senderEmail || null
      );
    } catch (err) {
      logger.error(
        `[Quotation Service] template email (${templateName}) failed for ${recipientEmail}: ${err.message}`
      );
    }
  }

  if (notifyUserId && !skipSelf) {
    try {
      await notificationHelper.createForUser(notifyUserId, {
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        module: 'lead',
        entity_type: 'quotation',
        entity_id: quotation._id,
      });
    } catch (err) {
      logger.error(
        `[Quotation Service] in-app notification failed for user ${notifyUserId}: ${err.message}`
      );
    }
  }
}

async function notifySignatoryApprovalRequest(quotation, actor, { isResubmit = false } = {}) {
  const signatoryUserId = userIdOf(quotation.signatory_user);
  const signatoryEmail =
    quotation.signatory_email ||
    (quotation.signatory_user && quotation.signatory_user.email) ||
    null;
  const recipientName =
    quotation.signatory_name ||
    quotation.signatory_user?.name ||
    'Authorized Signatory';
  const actorName = actor?.name || actor?.email || 'Quotation Creator';
  const customer = quotation.customer_name || 'Customer';
  const qNo = quotation.quotation_no || '';

  const subject = isResubmit
    ? `[Approval Required] Updated Quotation #${qNo} — ${customer}`
    : `[Approval Required] Quotation #${qNo} — ${customer}`;

  await notifyQuotationStakeholders({
    quotation,
    recipientEmail: signatoryEmail,
    recipientUserId: signatoryUserId,
    recipientName,
    actorUserId: actor?._id,
    templateName: TEMPLATE_APPROVAL_REQUEST,
    templateParams: quotationCommonParams(quotation, {
      subject,
      recipientName,
      actorName,
      headerSubtitle: isResubmit
        ? 'Updated quotation awaiting your approval'
        : 'Quotation awaiting your approval',
      badgeLabel: isResubmit ? 'RESUBMITTED' : 'PENDING APPROVAL',
      introText: isResubmit
        ? `Quotation <strong>#${qNo}</strong> for <strong>${customer}</strong> was <strong>updated</strong> by <strong>${actorName}</strong> and resubmitted for your signatory approval.`
        : `Quotation <strong>#${qNo}</strong> for <strong>${customer}</strong> has been submitted for your signatory approval by <strong>${actorName}</strong>.`,
      portalHint:
        'Please log in to Lead Manager to review this quotation and approve or reject it.',
    }),
    notificationTitle: isResubmit
      ? `Updated quotation #${qNo} needs approval`
      : `Quotation #${qNo} needs your approval`,
    notificationMessage: `Quotation #${qNo} for ${customer} needs your approval`,
    notificationType: 'info',
  });
}

async function notifyCreatorDecision(quotation, actor, { approved, rejectionReason = '' } = {}) {
  const creatorUserId = userIdOf(quotation.created_by);
  const creatorEmail =
    (quotation.created_by && quotation.created_by.email) || null;
  const recipientName = quotation.created_by?.name || 'Creator';
  const actorName = actor?.name || quotation.signatory_name || 'Authorized Signatory';
  const customer = quotation.customer_name || 'Customer';
  const qNo = quotation.quotation_no || '';
  const decisionDate = new Date().toLocaleDateString('en-IN');

  if (approved) {
    await notifyQuotationStakeholders({
      quotation,
      recipientEmail: creatorEmail,
      recipientUserId: creatorUserId,
      recipientName,
      actorUserId: actor?._id,
      templateName: TEMPLATE_APPROVED,
      templateParams: quotationCommonParams(quotation, {
        subject: `[Approved] Quotation #${qNo} — ${customer}`,
        recipientName,
        actorName,
        decisionDate,
        portalHint:
          'You can now send the proposal email to the client from Lead Manager.',
      }),
      notificationTitle: `Quotation #${qNo} approved`,
      notificationMessage: `Quotation #${qNo} was approved by ${actorName}`,
      notificationType: 'success',
    });
    return;
  }

  const reason = rejectionReason || quotation.rejection_reason || 'Rejected by signatory';
  await notifyQuotationStakeholders({
    quotation,
    recipientEmail: creatorEmail,
    recipientUserId: creatorUserId,
    recipientName,
    actorUserId: actor?._id,
    templateName: TEMPLATE_REJECTED,
    templateParams: quotationCommonParams(quotation, {
      subject: `[Rejected] Quotation #${qNo} — ${customer}`,
      recipientName,
      actorName,
      rejectionReason: reason,
      portalHint:
        'Please review and update the quotation draft before resubmitting for approval.',
    }),
    notificationTitle: `Quotation #${qNo} rejected`,
    notificationMessage: `Quotation #${qNo} was rejected by ${actorName}`,
    notificationType: 'warning',
  });
}

/**
 * Converts a positive number to Indian currency words format (Lakhs / Crores).
 * @param {number} num
 * @returns {string}
 */
function numberToIndianWords(num) {
  if (num == null || isNaN(num)) return '';
  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';

  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 20) return units[n];
    const rem = n % 10;
    return tens[Math.floor(n / 10)] + (rem ? ' ' + units[rem] : '');
  }

  function convertThreeDigits(n) {
    let str = '';
    if (Math.floor(n / 100) > 0) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      str += convertTwoDigits(n);
    }
    return str.trim();
  }

  let crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  let lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  let thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  let hundred = rem;

  let result = '';
  if (crore > 0) {
    result += (crore < 100 ? convertTwoDigits(crore) : convertThreeDigits(crore)) + ' Crore ';
  }
  if (lakh > 0) {
    result += convertTwoDigits(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    result += convertTwoDigits(thousand) + ' Thousand ';
  }
  if (hundred > 0) {
    result += convertThreeDigits(hundred) + ' ';
  }

  const paise = Math.round((Math.abs(num) - n) * 100);
  let str = result.trim() + ' Rupees';
  if (paise > 0) {
    str += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  str += ' Only';
  if (num < 0) {
    return 'Minus ' + str;
  }
  return str;
}

/**
 * Generate sequential quotation number (e.g., QT-20260901-0001).
 */
async function generateQuotationNo() {
  const { LeadQuotation } = getModels();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `QT-${yyyy}${mm}${dd}-`;

  const latestDocs = await LeadQuotation.collection
    .find({ quotation_no: { $regex: `^${datePrefix}\\d+` } })
    .sort({ quotation_no: -1 })
    .limit(1)
    .toArray();

  let nextSeq = 1;
  if (latestDocs && latestDocs.length > 0 && latestDocs[0].quotation_no) {
    const match = String(latestDocs[0].quotation_no).match(/-(\d+)$/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed >= nextSeq) {
        nextSeq = parsed + 1;
      }
    }
  }

  let candidate = `${datePrefix}${String(nextSeq).padStart(4, '0')}`;
  let exists = await LeadQuotation.collection.findOne({ quotation_no: candidate });
  while (exists) {
    nextSeq += 1;
    candidate = `${datePrefix}${String(nextSeq).padStart(4, '0')}`;
    exists = await LeadQuotation.collection.findOne({ quotation_no: candidate });
  }

  return candidate;
}

/**
 * Generate sequential reference number (e.g., Q-1001, Q-1002...).
 */
async function generateRefNo() {
  const { LeadQuotation } = getModels();

  const allDocs = await LeadQuotation.collection
    .find({ deletedAt: null }, { projection: { ref_no: 1, quotation_no: 1 } })
    .toArray();

  let maxSeq = 1000;
  if (allDocs && allDocs.length > 0) {
    for (const doc of allDocs) {
      const ref = doc.ref_no || doc.quotation_no || '';
      const matches = String(ref).match(/(\d+)/g);
      if (matches && matches.length > 0) {
        const num = parseInt(matches[matches.length - 1], 10);
        if (!Number.isNaN(num) && num < 1000000 && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  let candidate = `Q-${maxSeq + 1}`;
  let exists = await LeadQuotation.collection.findOne({ ref_no: candidate });
  while (exists) {
    maxSeq += 1;
    candidate = `Q-${maxSeq + 1}`;
    exists = await LeadQuotation.collection.findOne({ ref_no: candidate });
  }

  return candidate;
}

/**
 * Get default terms & conditions template.
 */
function getDefaultTermsAndConditions(company) {
  const companyName = company?.legal_name || company?.trade_name || 'the Company';
  const gstin = company?.gstin || '';
  const bankName = company?.bank_name || ' ';
  const branchName = company?.branch_name || ' ';
  const accNo = company?.account_number || ' ';
  const ifsc = company?.ifsc_code || ' ';
  const accName = company?.account_name || ' ';

  return [
    `VALIDITY OF OFFER: The price quoted for this Proposal is valid for 15 days from such communication to Customer and thereafter the same shall be subject to reconfirmation by ${companyName}.`,
    'Taxes are Extra in above offer.',
    'PAYMENT TERMS: The payment terms applicable are as follows:\n' +
    'a) Advance amount of 70% of the total contract value along with GST Taxes to be paid by Customer along with the Purchase Order.\n' +
    'b) 20% of the total contract value to be paid by Customer on readiness of materials before dispatch.\n' +
    'c) Remaining 10% of the total contract value to be paid by Customer within three (3) days from installation and commissioning and submission of invoice thereof.',
    'COST & SCOPE: The price given above is Exclusive of taxes, I&C, Freight FOR Site G Floor. Any change in scope of work or addition to the bill of materials and/or ratings or any variation, whatsoever, shall be charged extra to Customer at actual. Un-loading at Site Floor in Customer Scope.',
    'DELIVERY & INSTALLATION: The delivery date will be 4-6 Weeks from the date of acceptance of Purchase Order & will be installed by Company Technical Team.',
    'WARRANTY: The Machine Carries a One (1) years’ warranty from the date of Installation or 14 Months from the date of Billing whichever is Earlier. Warranty terms is as per company norms if the machine is relocated from original place of installation.',
    'AFTER SALE SERVICE: Machine service after sale will be provided directly by company engineer or you can call on Toll free number 1800-120-9500. Note ** NIBP Module is Optional in 4008 Sng.',
    'No Consumable Material Coming along with Machine as a part of billing and will be billed extra if required.',
    `GST No: ${gstin}`,
    'PRICE VALIDITY TERMS for the Supply of Dialysis Equipment/Services:\n' +
    '1. Validity Period: Prices quoted are valid for 15 days from the date of submission.\n' +
    "2. Old Prices: Prices quoted outside of this 15 day validity period will not be considered for the finalization of the proposal without the supplier's explicit consent.",
    `BANK DETAILS:\nName - ${accName}.\nBank - ${bankName}, ${branchName}\nA/c No. – ${accNo}\nIFSC - ${ifsc}`,
    'All Installation material to be used as per guidelines from Fresenius Medical Care INDIA Limited.',
  ];
}

/**
 * Retrieve default quotation terms & conditions directly from CompanyInfo.
 */
async function getDefaultTerms() {
  const { TermsAndConditions, TermsText } = getModels();

  // 1. Try fetching from TermsAndConditions & TermsText
  const activeDefaultTerms = await TermsAndConditions.findOne({
    type: 'quotation',
    is_default: true,
    is_active: true,
    deletedAt: null,
  });

  if (activeDefaultTerms) {
    const textDocs = await TermsText.find({
      terms_and_conditions_id: activeDefaultTerms._id,
      is_active: true,
      deletedAt: null,
    })
      .sort({ sequence: 1, createdAt: 1 })
      .lean();

    if (textDocs.length > 0) {
      return textDocs.map((t) => t.text);
    }
  }

  // 2. Fallback to CompanyInfo quotation_terms from auth-service
  const company = await authService.getCompanyInfo();
  if (Array.isArray(company.quotation_terms) && company.quotation_terms.length > 0) {
    return company.quotation_terms;
  }

  return getDefaultTermsAndConditions(company);
}

/**
 * Recalculate quotation line totals and financial summary.
 */
function computeTotals(items, gstEnabled = true) {
  let subtotal = 0;
  let totalGst = 0;
  let totalDiscount = 0;
  const isGstActive = gstEnabled !== false;

  const computedItems = (items || []).map((item) => {
    const {
      qty,
      rate,
      grossAmount,
      discountPercent,
      discountAmount,
      taxableAmount,
      gstRate,
    } = computeQuotationLineAmounts(item, { gstEnabled: isGstActive });

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;
    let totalGstAmount = 0;

    const itemGstActive = isGstActive && item.gst_enabled !== false;
    if (itemGstActive) {
      if (item.igst_rate && Number(item.igst_rate) > 0) {
        igstRate = Number(item.igst_rate);
        igstAmount = Math.round(((taxableAmount * igstRate) / 100) * 100) / 100;
        totalGstAmount = igstAmount;
      } else {
        const halfRate = gstRate / 2;
        cgstRate = halfRate;
        sgstRate = halfRate;
        cgstAmount = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
        sgstAmount = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
        totalGstAmount = Math.round((cgstAmount + sgstAmount) * 100) / 100;
      }
    }

    const lineTotal = Math.round((taxableAmount + totalGstAmount) * 100) / 100;

    totalDiscount += discountAmount;
    subtotal += taxableAmount;
    totalGst += totalGstAmount;

    return {
      ...item,
      gst_enabled: item.gst_enabled !== false,
      quantity: qty,
      rate,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      gst_rate: gstRate,
      cgst_rate: cgstRate,
      cgst_amount: cgstAmount,
      sgst_rate: sgstRate,
      sgst_amount: sgstAmount,
      igst_rate: igstRate,
      igst_amount: igstAmount,
      total_gst_amount: totalGstAmount,
      line_total: lineTotal,
    };
  });

  totalDiscount = Math.round(totalDiscount * 100) / 100;
  subtotal = Math.round(subtotal * 100) / 100;
  totalGst = Math.round(totalGst * 100) / 100;
  const rawGrandTotal = subtotal + totalGst;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;
  const amountInWords = numberToIndianWords(grandTotal);

  return {
    items: computedItems,
    total_discount: totalDiscount,
    subtotal,
    total_gst: totalGst,
    round_off: roundOff,
    grand_total: grandTotal,
    amount_in_words: amountInWords,
  };
}

/**
 * Mirror quotation line rates onto the lead's product pricing and estimated value.
 */
function applyQuotationPricingToLead(lead, items) {
  const existingProducts = Array.isArray(lead.products) ? lead.products : [];

  const nextProducts = (items || [])
    .filter((item) => String(item.product_name || '').trim())
    .map((item) => {
      const itemProductId = item.product ? String(item.product) : '';
      const itemName = String(item.product_name || '').trim().toLowerCase();
      const existing = existingProducts.find((p) => {
        const pId = p.product ? String(p.product) : '';
        if (itemProductId && pId && itemProductId === pId) return true;
        return String(p.product_name || '').trim().toLowerCase() === itemName;
      });

      return {
        product: item.product || existing?.product || undefined,
        product_name: String(item.product_name).trim(),
        quantity: Number(item.quantity) || 1,
        target_price: Number(item.rate) || 0,
        unit: item.unit || existing?.unit || 'pcs',
        remarks: existing?.remarks || item.description || '',
      };
    });

  const estimatedValue =
    Math.round(
      nextProducts.reduce(
        (sum, p) => sum + Number(p.quantity || 0) * Number(p.target_price || 0),
        0
      ) * 100
    ) / 100;

  lead.products = nextProducts;
  lead.estimated_value = estimatedValue;
  return estimatedValue;
}

/**
 * Keep the parent lead in the quotation pipeline stage (unless already closed).
 */
function advanceLeadToQuotationStatus(lead) {
  if (!lead || ['won', 'lost', 'converted'].includes(lead.status)) {
    return false;
  }
  if (['new', 'assigned', 'follow_up'].includes(lead.status)) {
    lead.status = 'quotation';
    return true;
  }
  return false;
}

/**
 * Build visibility filter for quotation queries.
 * - Admin: sees all quotations.
 * - Manager / Coordinator: quotations created by, sold by, or signed by anyone in their reporting downline (incl. self).
 * - Executive: own sales rep / creator / signatory quotes and quotes on leads assigned to them.
 */
async function buildQuotationVisibilityFilter(user) {
  if (!user || !user._id) return { _id: null };

  if (isAdmin(user)) {
    return {};
  }

  if (isExecutive(user) && !isManager(user) && !isCoordinator(user)) {
    const { Lead } = getModels();
    const uid = asObjectId(user._id);
    const assignedLeads = await Lead.find({ assigned_to: uid, deletedAt: null }).select('_id').lean();
    const leadIds = assignedLeads.map((l) => l._id);
    const userEmail = (user.email || '').toLowerCase().trim();
    const emailClause = userEmail
      ? [{ signatory_email: new RegExp(`^${userEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') }]
      : [];
    const orClause = [
      { created_by: uid },
      { sales_person_user: uid },
      { signatory_user: uid },
      ...emailClause,
    ];
    if (leadIds.length > 0) {
      orClause.push({ lead: { $in: leadIds } });
    }
    return { $or: orClause };
  }

  if (isManager(user) || isCoordinator(user)) {
    const visibleIds = await getVisibleLeadUserIds(user);
    const userEmail = (user.email || '').toLowerCase().trim();
    const emailClause = userEmail
      ? [{ signatory_email: new RegExp(`^${userEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') }]
      : [];

    if (visibleIds && visibleIds.length > 0) {
      const objIds = visibleIds.map((id) => asObjectId(id)).filter(Boolean);
      return {
        $or: [
          { created_by: { $in: objIds } },
          { sales_person_user: { $in: objIds } },
          { signatory_user: { $in: objIds } },
          ...emailClause,
        ],
      };
    }

    return {
      $or: [
        { created_by: user._id },
        { sales_person_user: user._id },
        { signatory_user: user._id },
        ...emailClause,
      ],
    };
  }

  return { _id: null };
}

async function assertQuotationVisible(quotationId, user) {
  const visibilityFilter = await buildQuotationVisibilityFilter(user);
  if (visibilityFilter._id === null) {
    throw new ApiError(403, 'You do not have permission to view this quotation');
  }
  if (Object.keys(visibilityFilter).length === 0) {
    return;
  }
  const { LeadQuotation } = getModels();
  const found = await LeadQuotation.findOne({
    _id: quotationId,
    deletedAt: null,
    $and: [visibilityFilter],
  })
    .select('_id')
    .lean();
  if (!found) {
    throw new ApiError(404, 'Quotation not found');
  }
}

/**
 * Automatically expire all active quotations that have passed their valid_until date.
 */
async function autoExpireQuotations() {
  const { LeadQuotation } = getModels();
  const now = new Date();
  const filter = {
    deletedAt: null,
    valid_until: { $lt: now },
    status: { $in: ['draft', 'pending_approval', 'approved', 'sent', 'in_negotiation', 'on_hold'] },
  };

  try {
    const expiredQuotes = await LeadQuotation.find(filter)
      .select('_id quotation_no customer_name created_by valid_until status')
      .lean();

    if (expiredQuotes.length === 0) {
      return { count: 0, expired: [] };
    }

    const ids = expiredQuotes.map((q) => q._id);
    await LeadQuotation.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'expired' } }
    );

    for (const q of expiredQuotes) {
      await activityService.create({
        entity_type: 'quotation',
        entity_id: q._id,
        action: 'status_changed',
        actor: q.created_by || null,
        message: `Quotation #${q.quotation_no} auto-expired (valid until ${q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-IN') : 'N/A'})`,
        new_value: { status: 'expired', previous_status: q.status },
      }).catch(() => {});
    }

    logger.info(`[Quotation Service] Auto-expired ${ids.length} quotation(s) past valid_until.`);
    return { count: ids.length, expired: expiredQuotes };
  } catch (err) {
    logger.error(`[Quotation Service] autoExpireQuotations error: ${err.message}`);
    return { count: 0, expired: [] };
  }
}

/**
 * Check and send 48-hour pre-expiry alerts to creators and sales persons.
 */
async function checkAndSendPreExpiryAlerts() {
  const { LeadQuotation } = getModels();
  const now = new Date();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    const filter = {
      deletedAt: null,
      valid_until: { $gt: now, $lte: in48Hours },
      status: { $in: ['approved', 'sent', 'in_negotiation'] },
      expiry_alert_sent_at: null,
    };

    const upcomingQuotes = await LeadQuotation.find(filter)
      .populate('created_by', 'name email')
      .populate('sales_person_user', 'name email')
      .populate('signatory_user', 'name email');

    for (const quote of upcomingQuotes) {
      const creatorId = userIdOf(quote.created_by);
      const salesId = userIdOf(quote.sales_person_user);
      const targetUsers = Array.from(new Set([creatorId, salesId].filter(Boolean)));

      const daysLeft = Math.max(1, Math.ceil((new Date(quote.valid_until) - now) / (1000 * 60 * 60 * 24)));
      const title = `Quotation #${quote.quotation_no} Expiring in ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`;
      const msg = `Quotation #${quote.quotation_no} for ${quote.customer_name || 'Customer'} expires on ${new Date(quote.valid_until).toLocaleDateString('en-IN')}. Please follow up or extend validity.`;

      for (const uid of targetUsers) {
        await notificationHelper.createForUser(uid, {
          title,
          message: msg,
          type: 'warning',
          module: 'lead',
          entity_type: 'quotation',
          entity_id: quote._id,
        }).catch(() => {});
      }

      quote.expiry_alert_sent_at = now;
      await quote.save().catch(() => {});
    }

    return { count: upcomingQuotes.length };
  } catch (err) {
    logger.error(`[Quotation Service] checkAndSendPreExpiryAlerts error: ${err.message}`);
    return { count: 0 };
  }
}

/**
 * List all quotations with filtering and pagination.
 */
async function listAll(query = {}, user) {
  const { LeadQuotation } = getModels();

  // Run lazy auto-expiry for any active quotes past validity date
  await autoExpireQuotations().catch(() => {});

  const filter = { deletedAt: null };
  const conditions = [];

  const visibilityFilter = await buildQuotationVisibilityFilter(user);
  if (Object.keys(visibilityFilter).length > 0) {
    conditions.push(visibilityFilter);
  }

  if (query.lead) {
    filter.lead = query.lead;
  }
  if (query.status) {
    const statusParam = String(query.status).trim();
    if (statusParam === 'in_negotiation' || statusParam === 'active_pipeline' || statusParam === 'quoted') {
      filter.status = { $in: ACTIVE_PIPELINE_STATUSES };
    } else {
      filter.status = statusParam;
    }
  }
  if (query.search && String(query.search).trim()) {
    const searchRegex = new RegExp(String(query.search).trim(), 'i');
    conditions.push({
      $or: [
        { quotation_no: searchRegex },
        { ref_no: searchRegex },
        { customer_name: searchRegex },
        { subject: searchRegex },
      ],
    });
  }

  if (conditions.length > 0) {
    filter.$and = conditions;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 50);
  const skip = (page - 1) * limit;

  const [total, quotations] = await Promise.all([
    LeadQuotation.countDocuments(filter),
    LeadQuotation.find(filter)
      .populate('lead', 'lead_no organization_name first_name last_name status assigned_to')
      .populate('created_by', 'name email department')
      .populate('sales_person_user', 'name email department phone designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    quotations,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * List quotations for a lead.
 */
async function listByLead(leadId, user) {
  const { Lead, LeadQuotation } = getModels();

  const lead = await Lead.findOne({ _id: leadId, deletedAt: null });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const filter = {
    lead: leadId,
    deletedAt: null,
  };

  const visibilityFilter = await buildQuotationVisibilityFilter(user);
  if (Object.keys(visibilityFilter).length > 0) {
    filter.$and = [visibilityFilter];
  }

  const quotations = await LeadQuotation.find(filter)
    .populate('created_by', 'name email department')
    .sort({ createdAt: -1 })
    .lean();

  return quotations;
}

/**
 * Create a new quotation. Supports overloaded signatures:
 * - create(leadId, body, user)
 * - create(body, user)
 */
async function create(leadIdOrBody, bodyOrUser, userParam) {
  let leadId;
  let body;
  let user;

  if (userParam !== undefined) {
    // 3-argument call: create(leadId, body, user)
    leadId = leadIdOrBody ? String(leadIdOrBody) : undefined;
    body = bodyOrUser || {};
    user = userParam;
    if (!leadId && (body.lead || body.leadId)) {
      leadId = String(body.lead || body.leadId);
    }
  } else {
    // 2-argument call: create(body, user)
    body = leadIdOrBody || {};
    user = bodyOrUser;
    leadId = body.lead || body.leadId ? String(body.lead || body.leadId) : undefined;
  }

  const { Lead, LeadQuotation, User } = getModels();

  let lead = null;
  if (leadId) {
    lead = await Lead.findOne({ _id: leadId, deletedAt: null });
    if (!lead) throw new ApiError(404, 'Lead not found');

    if (['lost'].includes(lead.status)) {
      throw new ApiError(400, `Cannot create quotation for a lead in '${lead.status}' status`);
    }
  }

  if (!isQuotationManager(user)) {
    throw new ApiError(
      403,
      'Only administrators, managers, coordinators, and executives can create quotations'
    );
  }

  // Resolve assigned user (must be admin or finance department; excluding sales)
  let assignedUser = null;
  if (lead && lead.assigned_to) {
    const leadUser = await User.findById(lead.assigned_to).lean();
    if (leadUser && ['admin', 'finance'].includes(leadUser.department)) {
      assignedUser = leadUser;
    }
  }
  if (!assignedUser) {
    assignedUser = await User.findOne({ department: { $in: ['admin', 'finance'] }, is_active: true }).lean();
  }
  const defaultSignatory = assignedUser || user;

  const company = await authService.getCompanyInfo();

  const quotationNo = body.quotation_no || (await generateQuotationNo());
  const refNo = body.ref_no || (await generateRefNo());

  const validityDays = Number(body.validity_days) || 15;
  const quotationDate = body.quotation_date ? new Date(body.quotation_date) : new Date();
  const validUntil = body.valid_until
    ? new Date(body.valid_until)
    : new Date(quotationDate.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const gstEnabled = body.gst_enabled !== false;
  const { items, total_discount, subtotal, total_gst, round_off, grand_total, amount_in_words } = computeTotals(
    body.items && body.items.length > 0
      ? body.items
      : [
        {
          product_name: lead?.requirements || body.subject || 'Item / Product',
          hsn_code: '',
          quantity: 1,
          unit: 'Nos',
          rate: lead?.estimated_value || 0,
          gst_rate: gstEnabled ? 18 : 0,
        },
      ],
    gstEnabled
  );

  const defaultTerms = await getDefaultTerms();

  const quotationPayload = {
    quotation_no: quotationNo,
    ref_no: refNo,
    customer_ref: body.customer_ref || body.customerRef || '',
    lead: lead ? lead._id : null,
    party_id: body.party_id || (lead ? (lead.party_id || null) : null),
    quotation_date: quotationDate,
    valid_until: validUntil,
    validity_days: validityDays,
    subject: body.subject || (items[0]?.product_name ? `Offer For ${items[0].product_name}` : 'Quotation Proposal'),
    message: body.message || body.quotation_message || '',
    quotation_message: body.quotation_message || body.message || '',
    customer_name: body.customer_name || (lead ? (lead.organization_name || lead.party_name || `M/s. ${lead.first_name} ${lead.last_name}`.trim()) : 'Customer'),
    kind_attn: body.kind_attn || (lead ? `${lead.first_name} ${lead.last_name}`.trim() : ''),
    phone: body.phone || lead?.phone || '',
    cell: body.cell || lead?.mobile || lead?.phone || '',
    email: body.email || lead?.email || '',
    gstin: body.gstin || lead?.gstin || '',
    address: body.address || {
      address_line_1: lead?.address?.street || '',
      city: lead?.address?.city || '',
      state: lead?.address?.state || '',
      pincode: lead?.address?.pincode || '',
      country: lead?.address?.country || 'India',
    },
    items,
    total_discount,
    subtotal,
    total_gst,
    round_off,
    grand_total,
    amount_in_words,
    terms_and_conditions: Array.isArray(body.terms_and_conditions)
      ? body.terms_and_conditions
      : [],
    branch_id: body.branch_id || body.company_branch_id || null,
    branch_code: body.branch_code || body.company_branch_code || '',
    company_branch_name: body.company_branch_name || body.branch_name_selected || '',
    company_name: body.company_name || company?.legal_name || company?.trade_name || '',
    company_regd_address:
      body.company_regd_address ||
      (company?.address
        ? `${company.address}, ${company.city} - ${company.pincode}`
        : ''),
    company_phone: body.company_phone || company?.phone || '',
    company_email: body.company_email || company?.email || '',
    company_gstin: body.company_gstin || company?.gstin || '',
    bank_name: body.bank_name || company?.bank_name || '',
    account_name: body.account_name || company?.account_name || '',
    account_number: body.account_number || company?.account_number || '',
    ifsc_code: body.ifsc_code || company?.ifsc_code || '',
    branch_name: body.branch_name || company?.branch_name || '',
    account_type: body.account_type || company?.account_type || '',
    signatory_name: body.signatory_name || defaultSignatory?.name || '',
    signatory_phone: body.signatory_phone || defaultSignatory?.phone || '',
    signatory_email: body.signatory_email || defaultSignatory?.email || '',
    signatory_designation: body.signatory_designation || (defaultSignatory?.department ? (defaultSignatory.department.charAt(0).toUpperCase() + defaultSignatory.department.slice(1)) : 'Authorized Signatory'),
    signatory_user: body.signatory_user || defaultSignatory?._id || null,
    sales_person_name: body.sales_person_name || '',
    sales_person_phone: body.sales_person_phone || '',
    sales_person_email: body.sales_person_email || '',
    sales_person_designation: body.sales_person_designation || 'Sales Executive',
    sales_person_user: body.sales_person_user || null,
    gst_enabled: gstEnabled,
    approval_status: body.approval_status || 'pending_approval',
    status: body.status || 'draft',
    created_by: user._id,
    updated_by: user._id,
  };

  let quotation;
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      quotation = await LeadQuotation.create(quotationPayload);
      break;
    } catch (err) {
      const isDup =
        err &&
        (err.code === 11000 || err.code === '11000') &&
        String(err.message || '').includes('quotation_no');
      if (!isDup || attempt === maxAttempts - 1) {
        throw err;
      }
      quotationPayload.quotation_no = await generateQuotationNo();
    }
  }

  if (lead) {
    applyQuotationPricingToLead(lead, items);
    advanceLeadToQuotationStatus(lead);
    lead.last_activity_at = new Date();
    await lead.save();

    // Log activity
    await activityService.create({
      entity_type: 'lead',
      entity_id: lead._id,
      action: 'generated',
      actor: user._id,
      message: `Generated Quotation #${quotation.quotation_no} (Ref: ${quotation.ref_no}) for ₹${quotation.grand_total.toLocaleString('en-IN')}`,
      new_value: {
        quotation_id: quotation._id,
        quotation_no: quotation.quotation_no,
        grand_total: quotation.grand_total,
        estimated_value: lead.estimated_value,
      },
    });
  }

  return quotation;
}

/**
 * Get quotation by id.
 */
async function getById(id, user) {
  const { LeadQuotation } = getModels();

  // Lazy auto-expiry check for this quotation if past valid_until
  const now = new Date();
  const raw = await LeadQuotation.findOne({ _id: id, deletedAt: null });
  if (
    raw &&
    raw.valid_until &&
    new Date(raw.valid_until) < now &&
    ['draft', 'pending_approval', 'approved', 'sent', 'in_negotiation', 'on_hold'].includes(raw.status)
  ) {
    raw.status = 'expired';
    await raw.save();
  }

  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null })
    .populate('lead')
    .populate('created_by', 'name email department')
    .populate('signatory_user', 'name email department phone designation')
    .populate('sales_person_user', 'name email department phone designation')
    .populate('conversion.converted_by', 'name email department')
    .populate('conversion.party_id')
    .populate('conversion.order_id', 'order_no status grand_total total_amount')
    .populate('revision_history.saved_by', 'name email department')
    .populate('revision_history.approved_by', 'name email department')
    .populate('revision_history.signatory_user', 'name email department phone designation')
    .populate('revision_history.sales_person_user', 'name email department phone designation')
    .populate('proforma_details.generated_by', 'name email department')
    .populate({ path: 'validity_extension_history.extended_by', select: 'name email department', strictPopulate: false })
    .lean();

  if (!quotation) throw new ApiError(404, 'Quotation not found');
  await assertQuotationVisible(id, user);
  return quotation;
}

/**
 * Helper to build an immutable snapshot of all quotation details for revision_history.
 */
function buildRevisionSnapshot(quotation, user, changeSummary) {
  const previousVersion = quotation.version || 1;
  return {
    version: previousVersion,
    quotation_no: quotation.quotation_no || '',
    ref_no: quotation.ref_no || '',
    customer_ref: quotation.customer_ref || '',
    quotation_date: quotation.quotation_date || null,
    valid_until: quotation.valid_until || null,
    validity_days: quotation.validity_days || 15,
    subject: quotation.subject || '',
    message: quotation.message || '',
    quotation_message: quotation.quotation_message || '',
    customer_name: quotation.customer_name || '',
    kind_attn: quotation.kind_attn || '',
    phone: quotation.phone || '',
    cell: quotation.cell || '',
    email: quotation.email || '',
    gstin: quotation.gstin || '',
    address: quotation.address ? JSON.parse(JSON.stringify(quotation.address)) : {},
    items: quotation.items ? JSON.parse(JSON.stringify(quotation.items)) : [],
    subtotal: quotation.subtotal || 0,
    total_discount: quotation.total_discount || 0,
    gst_enabled: quotation.gst_enabled !== false,
    total_gst: quotation.total_gst || 0,
    round_off: quotation.round_off || 0,
    grand_total: quotation.grand_total || 0,
    amount_in_words: quotation.amount_in_words || '',
    terms_and_conditions: Array.isArray(quotation.terms_and_conditions) ? [...quotation.terms_and_conditions] : [],
    branch_id: quotation.branch_id || null,
    branch_code: quotation.branch_code || '',
    company_branch_name: quotation.company_branch_name || '',
    company_name: quotation.company_name || '',
    company_regd_address: quotation.company_regd_address || '',
    company_phone: quotation.company_phone || '',
    company_email: quotation.company_email || '',
    company_gstin: quotation.company_gstin || '',
    bank_name: quotation.bank_name || '',
    account_name: quotation.account_name || '',
    account_number: quotation.account_number || '',
    ifsc_code: quotation.ifsc_code || '',
    branch_name: quotation.branch_name || '',
    account_type: quotation.account_type || '',
    signatory_name: quotation.signatory_name || '',
    signatory_phone: quotation.signatory_phone || '',
    signatory_email: quotation.signatory_email || '',
    signatory_designation: quotation.signatory_designation || '',
    signatory_user: quotation.signatory_user ? (quotation.signatory_user._id || quotation.signatory_user) : null,
    sales_person_name: quotation.sales_person_name || '',
    sales_person_phone: quotation.sales_person_phone || '',
    sales_person_email: quotation.sales_person_email || '',
    sales_person_designation: quotation.sales_person_designation || '',
    sales_person_user: quotation.sales_person_user ? (quotation.sales_person_user._id || quotation.sales_person_user) : null,
    status: quotation.status,
    approval_status: quotation.approval_status || 'pending_approval',
    approved_by: quotation.approved_by ? (quotation.approved_by._id || quotation.approved_by) : null,
    approved_at: quotation.approved_at || null,
    saved_by: user._id || user.id,
    saved_at: new Date(),
    change_summary: changeSummary || `Revised to version ${previousVersion + 1}`,
  };
}

/**
 * Update quotation.
 */
async function update(id, body, user) {
  const { Lead, LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  const isCreator = isQuotationCreator(user, quotation);

  // Detect if this is a content update (form edit) versus a status-only transition (e.g. marking accepted/on_hold)
  const isContentUpdate = Boolean(
    body.items ||
    body.terms_and_conditions ||
    body.subject ||
    body.party_id ||
    body.customer_name ||
    body.kind_attn ||
    body.address ||
    body.signatory_user ||
    body.sales_person_user ||
    body.validity_days ||
    body.valid_until ||
    body.ref_no
  );

  if (isContentUpdate) {
    if (!isAdmin(user) && !isCreator) {
      throw new ApiError(403, 'Only administrators and quotation creators can edit quotations');
    }
  } else if (body.status !== undefined || body.approval_status !== undefined) {
    if (!canActOnQuotationPipeline(user, quotation)) {
      throw new ApiError(403, 'You do not have permission to update this quotation status');
    }
  } else if (!isAdmin(user) && !isCreator) {
    throw new ApiError(403, 'Only administrators and quotation creators can edit quotations');
  }

  const previousStatus = quotation.status;
  const previousApprovalStatus = quotation.approval_status;
  const previousVersion = quotation.version || 1;
  let versionIncremented = false;

  if (isContentUpdate) {
    const isRevisionEligible =
      previousStatus !== 'draft' ||
      previousApprovalStatus === 'approved' ||
      previousVersion > 1;

    if (isRevisionEligible) {
      if (!Array.isArray(quotation.revision_history)) {
        quotation.revision_history = [];
      }
      quotation.revision_history.push(
        buildRevisionSnapshot(quotation, user, body.change_summary)
      );

      quotation.version = previousVersion + 1;
      versionIncremented = true;
    }
  }

  const gstEnabled = body.gst_enabled !== undefined ? Boolean(body.gst_enabled) : (quotation.gst_enabled !== false);
  if (body.items || body.gst_enabled !== undefined) {
    const computed = computeTotals(body.items || quotation.items, gstEnabled);
    quotation.items = computed.items;
    quotation.total_discount = computed.total_discount;
    quotation.subtotal = computed.subtotal;
    quotation.total_gst = computed.total_gst;
    quotation.round_off = computed.round_off;
    quotation.grand_total = computed.grand_total;
    quotation.amount_in_words = computed.amount_in_words;
    quotation.gst_enabled = gstEnabled;
  }

  const allowedFields = [
    'ref_no',
    'customer_ref',
    'party_id',
    'lead',
    'gst_enabled',
    'subject',
    'message',
    'quotation_message',
    'customer_name',
    'kind_attn',
    'phone',
    'cell',
    'email',
    'gstin',
    'address',
    'quotation_date',
    'valid_until',
    'validity_days',
    'terms_and_conditions',
    'branch_id',
    'branch_code',
    'company_branch_name',
    'company_name',
    'company_regd_address',
    'company_phone',
    'company_email',
    'company_gstin',
    'bank_name',
    'account_name',
    'account_number',
    'ifsc_code',
    'branch_name',
    'account_type',
    'signatory_name',
    'signatory_phone',
    'signatory_email',
    'signatory_designation',
    'signatory_user',
    'sales_person_name',
    'sales_person_phone',
    'sales_person_email',
    'sales_person_designation',
    'sales_person_user',
    'approval_status',
    'status',
    'lost_reason',
    'next_follow_up_at',
    'last_follow_up_at',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      quotation[field] = body[field];
    }
  }

  // If quotation content was updated, force it back to pending_approval for signatory re-approval
  if (isContentUpdate) {
    quotation.approval_status = 'pending_approval';
    quotation.status = 'pending_approval';
    quotation.approved_at = null;
    quotation.approved_by = null;
  }

  quotation.updated_by = user._id;
  await quotation.save();

  let leadAdvancedToQuotation = false;
  const lead = quotation.lead
    ? await Lead.findOne({ _id: quotation.lead, deletedAt: null })
    : null;

  if (lead && !['won', 'lost', 'converted'].includes(lead.status)) {
    if (body.items) {
      applyQuotationPricingToLead(lead, quotation.items);
    }
    const previousLeadStatus = lead.status;
    leadAdvancedToQuotation = advanceLeadToQuotationStatus(lead);
    lead.last_activity_at = new Date();
    await lead.save();

    // When quotation is marked sent, record lead pipeline advance if status changed.
    if (body.status === 'sent' && leadAdvancedToQuotation) {
      await activityService.create({
        entity_type: 'lead',
        entity_id: lead._id,
        action: 'status_changed',
        actor: user._id,
        message: `Quotation #${quotation.quotation_no} sent — lead moved from '${previousLeadStatus}' to 'quotation'`,
        old_value: { status: previousLeadStatus },
        new_value: {
          status: 'quotation',
          quotation_id: quotation._id,
          quotation_no: quotation.quotation_no,
        },
      });
    }
  }

  let message = `Updated Quotation #${quotation.quotation_no} (Ref: ${quotation.ref_no})`;
  let actionType = 'updated';

  if (isContentUpdate) {
    message = versionIncremented
      ? `Updated Quotation #${quotation.quotation_no} to Revision v${quotation.version} - Resubmitted for Signatory Approval`
      : `Updated Quotation #${quotation.quotation_no} - Resubmitted for Signatory Approval`;

    const populatedQuotation = await LeadQuotation.findOne({ _id: quotation._id })
      .populate('created_by', 'name email department')
      .populate('signatory_user', 'name email department');

    await notifySignatoryApprovalRequest(populatedQuotation || quotation, user, {
      isResubmit: true,
    });
  } else if (body.status && body.status !== previousStatus) {
    actionType = 'status_changed';
    if (body.status === 'rejected' && body.lost_reason) {
      message = `Quotation #${quotation.quotation_no} marked as REJECTED/LOST. Reason: ${body.lost_reason}`;
    } else if (body.status === 'in_negotiation') {
      message = `Quotation #${quotation.quotation_no} marked as IN NEGOTIATION`;
    } else {
      message =
        body.status === 'sent' && leadAdvancedToQuotation
          ? `Quotation #${quotation.quotation_no} marked as SENT — linked lead advanced to quotation`
          : `Quotation #${quotation.quotation_no} marked as '${body.status.toUpperCase()}'`;
    }
  }

  if (quotation.lead) {
    await activityService.create({
      entity_type: 'lead',
      entity_id: quotation.lead,
      action: actionType,
      actor: user._id,
      message,
      new_value: {
        quotation_id: quotation._id,
        quotation_no: quotation.quotation_no,
        grand_total: quotation.grand_total,
        status: quotation.status,
        lead_advanced_to_quotation: leadAdvancedToQuotation || undefined,
      },
    });
  }

  return quotation;
}

/**
 * Submit quotation for signatory approval (transitions from draft to pending_approval).
 */
async function submitForApproval(id, user) {
  const { LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null })
    .populate('created_by', 'name email department')
    .populate('signatory_user', 'name email department');
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  await assertQuotationVisible(id, user);
  if (!canActOnQuotationPipeline(user, quotation)) {
    throw new ApiError(403, 'You do not have permission to submit this quotation for approval');
  }
  if (quotation.status !== 'draft') {
    throw new ApiError(400, 'Only draft quotations can be submitted for approval');
  }

  quotation.approval_status = 'pending_approval';
  quotation.status = 'pending_approval';
  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    entity_type: 'lead',
    entity_id: quotation.lead,
    action: 'submitted_for_approval',
    actor: user._id,
    message: `Submitted Quotation #${quotation.quotation_no} for signatory approval`,
    new_value: {
      quotation_id: quotation._id,
      quotation_no: quotation.quotation_no,
      status: 'pending_approval',
    },
  });

  await notifySignatoryApprovalRequest(quotation, user, { isResubmit: false });

  return quotation;
}

/**
 * Delete quotation (soft delete).
 */
async function remove(id, user) {
  const { LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  if (!isQuotationManager(user)) {
    throw new ApiError(
      403,
      'Only administrators, managers, coordinators, and executives can delete quotations'
    );
  }

  quotation.deletedAt = new Date();
  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    entity_type: 'lead',
    entity_id: quotation.lead,
    action: 'deleted',
    actor: user._id,
    message: `Deleted Quotation #${quotation.quotation_no}`,
    new_value: {
      quotation_id: quotation._id,
      quotation_no: quotation.quotation_no,
    },
  });

  return { success: true };
}

/**
 * Approve quotation by assigned signatory or portal administrator.
 */
async function approve(id, user) {
  const { LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null })
    .populate('created_by', 'name email department')
    .populate('signatory_user', 'name email department');
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  const isSignatoryUser =
    isAdmin(user) ||
    (quotation.signatory_user && String(quotation.signatory_user._id || quotation.signatory_user) === String(user._id)) ||
    (quotation.signatory_email && quotation.signatory_email.toLowerCase() === (user.email || '').toLowerCase());

  if (!isSignatoryUser) {
    throw new ApiError(
      403,
      `Only assigned signatory (${quotation.signatory_name || 'Signatory'}) or Lead Manager Administrators can approve this quotation`
    );
  }

  quotation.approval_status = 'approved';
  quotation.approved_at = new Date();
  quotation.approved_by = user._id;
  quotation.status = 'approved';
  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    entity_type: 'lead',
    entity_id: quotation.lead,
    action: 'approved',
    actor: user._id,
    message: `${isAdmin(user) ? 'Administrator' : 'Signatory'} ${user.name || user.email} approved Quotation #${quotation.quotation_no}`,
    new_value: {
      quotation_id: quotation._id,
      quotation_no: quotation.quotation_no,
      approval_status: 'approved',
    },
  });

  await notifyCreatorDecision(quotation, user, { approved: true });

  return quotation;
}

/**
 * Reject quotation by assigned signatory or portal administrator.
 */
async function reject(id, reason, user) {
  const { LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null })
    .populate('created_by', 'name email department')
    .populate('signatory_user', 'name email department');
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  const isSignatoryUser =
    isAdmin(user) ||
    (quotation.signatory_user && String(quotation.signatory_user._id || quotation.signatory_user) === String(user._id)) ||
    (quotation.signatory_email && quotation.signatory_email.toLowerCase() === (user.email || '').toLowerCase());

  if (!isSignatoryUser) {
    throw new ApiError(
      403,
      `Only assigned signatory (${quotation.signatory_name || 'Signatory'}) or Lead Manager Administrators can reject this quotation`
    );
  }

  quotation.approval_status = 'rejected';
  quotation.status = 'rejected';
  quotation.rejection_reason = reason || 'Rejected by signatory';
  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    entity_type: 'lead',
    entity_id: quotation.lead,
    action: 'rejected',
    actor: user._id,
    message: `${isAdmin(user) ? 'Administrator' : 'Signatory'} ${user.name || user.email} rejected Quotation #${quotation.quotation_no}. Reason: ${reason || 'N/A'}`,
    new_value: {
      quotation_id: quotation._id,
      quotation_no: quotation.quotation_no,
      approval_status: 'rejected',
    },
  });

  await notifyCreatorDecision(quotation, user, {
    approved: false,
    rejectionReason: reason || 'Rejected by signatory',
  });

  return quotation;
}

/**
 * Schedule a new follow-up for a quotation.
 */
async function scheduleFollowUp(quotationId, body, user) {
  const { Lead, LeadQuotation, LeadFollowUp } = getModels();
  await assertQuotationVisible(quotationId, user);
  const quotation = await LeadQuotation.findOne({ _id: quotationId, deletedAt: null });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  const followUpDate = new Date(body.follow_up_date);
  if (isNaN(followUpDate.getTime())) {
    throw new ApiError(400, 'Invalid follow-up date');
  }

  const doc = await LeadFollowUp.create({
    quotation: quotation._id,
    lead: quotation.lead || null,
    follow_up_date: followUpDate,
    follow_up_time: body.follow_up_time ? String(body.follow_up_time).trim() : '',
    type: body.type || 'call',
    notes: body.notes ? String(body.notes).trim() : '',
    status: 'pending',
    created_by: user._id,
    updated_by: user._id,
  });

  quotation.next_follow_up_at = followUpDate;
  if (quotation.status === 'sent') {
    quotation.status = 'in_negotiation';
  }
  quotation.updated_by = user._id;
  await quotation.save();

  if (quotation.lead) {
    const lead = await Lead.findOne({ _id: quotation.lead, deletedAt: null });
    if (lead) {
      lead.next_follow_up_at = followUpDate;
      lead.last_activity_at = new Date();
      await lead.save();

      await activityService.create({
        actor: user._id,
        entity_type: 'lead',
        entity_id: lead._id,
        action: 'created',
        message: `Quotation #${quotation.quotation_no} follow-up scheduled (${body.type || 'call'}) for ${followUpDate.toLocaleDateString('en-IN')}`,
        new_value: {
          quotation_id: quotation._id,
          quotation_no: quotation.quotation_no,
          follow_up_date: followUpDate,
          type: body.type,
          notes: body.notes,
        },
      });
    }
  }

  return doc;
}

/**
 * List all follow-ups for a single quotation.
 */
async function listFollowUps(quotationId, user) {
  const { LeadQuotation, LeadFollowUp } = getModels();
  await assertQuotationVisible(quotationId, user);
  const quotation = await LeadQuotation.findOne({ _id: quotationId, deletedAt: null });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  const rows = await LeadFollowUp.find({ quotation: quotationId, deletedAt: null })
    .populate('created_by', 'name email')
    .populate('completed_by', 'name email')
    .sort({ follow_up_date: -1 })
    .lean();

  return rows;
}

/**
 * Complete a quotation follow-up, record outcome, and optionally schedule next follow-up.
 */
async function completeFollowUp(followUpId, body, user) {
  const { Lead, LeadQuotation, LeadFollowUp } = getModels();
  const fu = await LeadFollowUp.findOne({ _id: followUpId, deletedAt: null });
  if (!fu) throw new ApiError(404, 'Follow-up not found');

  if (fu.quotation) {
    await assertQuotationVisible(fu.quotation, user);
  }

  const quotation = await LeadQuotation.findOne({ _id: fu.quotation, deletedAt: null });
  const isConverted = quotation && quotation.status === 'converted';

  fu.status = 'completed';
  fu.outcome = body.outcome ? String(body.outcome).trim() : 'Follow-up completed';
  fu.completed_at = new Date();
  fu.completed_by = user._id;
  fu.updated_by = user._id;

  let nextFu = null;
  if (body.next_follow_up_date && !isConverted) {
    const nextDate = new Date(body.next_follow_up_date);
    fu.next_follow_up_date = nextDate;

    nextFu = await LeadFollowUp.create({
      quotation: fu.quotation || (quotation ? quotation._id : null),
      lead: fu.lead || (quotation ? quotation.lead : null),
      follow_up_date: nextDate,
      follow_up_time: body.next_follow_up_time || '',
      type: body.next_type || fu.type || 'call',
      notes: body.next_notes || '',
      status: 'pending',
      created_by: user._id,
      updated_by: user._id,
    });

    if (quotation) {
      quotation.next_follow_up_at = nextDate;
    }
  } else if (quotation && !isConverted) {
    const nextPending = await LeadFollowUp.findOne({
      quotation: quotation._id,
      status: 'pending',
      deletedAt: null,
      _id: { $ne: fu._id },
    }).sort({ follow_up_date: 1 });

    quotation.next_follow_up_at = nextPending ? nextPending.follow_up_date : null;
  } else if (quotation && isConverted) {
    quotation.next_follow_up_at = null;
  }

  if (quotation) {
    quotation.last_follow_up_at = new Date();
    if (quotation.status === 'sent') {
      quotation.status = 'in_negotiation';
    }
    quotation.updated_by = user._id;
    await quotation.save();
  }

  await fu.save();

  if (quotation && quotation.lead) {
    const lead = await Lead.findOne({ _id: quotation.lead, deletedAt: null });
    if (lead) {
      lead.last_contacted_at = new Date();
      lead.last_activity_at = new Date();
      if (body.next_follow_up_date) {
        lead.next_follow_up_at = new Date(body.next_follow_up_date);
      }
      await lead.save();

      await activityService.create({
        actor: user._id,
        entity_type: 'lead',
        entity_id: lead._id,
        action: 'status_changed',
        message: `Quotation #${quotation.quotation_no} follow-up completed: ${body.outcome || 'Done'}`,
        new_value: {
          quotation_id: quotation._id,
          quotation_no: quotation.quotation_no,
          outcome: body.outcome,
          next_follow_up_date: body.next_follow_up_date || null,
        },
      });
    }
  }

  return {
    completed: fu,
    next: nextFu,
  };
}

/**
 * Revise a quotation in-place (increments version, snapshots prior version into history).
 */
async function reviseQuotation(quotationId, user) {
  const { Lead, LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: quotationId, deletedAt: null });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  const isCreator =
    quotation.created_by &&
    String(quotation.created_by._id || quotation.created_by) === String(user._id);

  if (!isAdmin(user) && !isCreator) {
    throw new ApiError(403, 'Only administrators and quotation creators can edit quotations');
  }

  const previousVersion = quotation.version || 1;
  const previousStatus = quotation.status;
  const previousApprovalStatus = quotation.approval_status;

  if (!Array.isArray(quotation.revision_history)) {
    quotation.revision_history = [];
  }

  quotation.revision_history.push(
    buildRevisionSnapshot(quotation, user, `Created Revision v${previousVersion + 1} from v${previousVersion}`)
  );

  quotation.version = previousVersion + 1;
  quotation.status = 'draft';
  quotation.approval_status = 'pending_approval';
  quotation.approved_at = null;
  quotation.approved_by = null;
  quotation.updated_by = user._id;

  await quotation.save();

  if (quotation.lead) {
    await activityService.create({
      entity_type: 'lead',
      entity_id: quotation.lead,
      action: 'updated',
      actor: user._id,
      message: `Quotation #${quotation.quotation_no} revised to v${quotation.version}`,
      new_value: {
        quotation_id: quotation._id,
        quotation_no: quotation.quotation_no,
        version: quotation.version,
      },
    });
  }

  return quotation;
}

/**
 * Get dashboard KPI counters for Quotations commercial hub.
 */
async function getDashboardStats(query = {}, user) {
  const { LeadQuotation } = getModels();
  const andConditions = [{ deletedAt: null }];

  const visibilityFilter = user ? await buildQuotationVisibilityFilter(user) : {};
  if (Object.keys(visibilityFilter).length > 0) {
    andConditions.push(visibilityFilter);
  }

  // Period / Date filter
  if (query.from || query.to) {
    const dateCond = {};
    if (query.from) dateCond.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) dateCond.$lte = new Date(`${query.to}T23:59:59.999Z`);
    andConditions.push({ quotation_date: dateCond });
  } else if (query.startDate || query.endDate || query.start_date || query.end_date) {
    const s = query.startDate || query.start_date;
    const e = query.endDate || query.end_date;
    const dateCond = {};
    if (s) dateCond.$gte = new Date(s);
    if (e) dateCond.$lte = new Date(e);
    andConditions.push({ quotation_date: dateCond });
  }

  const q = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

  const allQuotes = await LeadQuotation.find(q)
    .select('quotation_no version status approval_status grand_total total_discount items valid_until quotation_date customer_name')
    .lean();

  let totalQuotations = allQuotes.length;
  let draftCount = 0;
  let pendingApprovalCount = 0;
  let approvedCount = 0;
  let sentCount = 0;
  let inNegotiationCount = 0;
  let activePipelineCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let expiredCount = 0;

  let totalQuotedValue = 0;
  let totalWonValue = 0;
  let totalDiscountValue = 0;
  let totalGrossValue = 0;
  let totalExpiredValue = 0;

  for (const quote of allQuotes) {
    const st = quote.status;
    const appSt = quote.approval_status;
    const gTotal = Number(quote.grand_total) || 0;
    const disc = Number(quote.total_discount) || 0;

    totalDiscountValue += disc;
    totalGrossValue += gTotal + disc;

    if (st === 'expired') {
      expiredCount += 1;
      totalExpiredValue += gTotal;
    } else if (appSt === 'pending_approval' || st === 'pending_approval') {
      pendingApprovalCount += 1;
    } else if (st === 'approved') {
      approvedCount += 1;
    } else if (st === 'sent') {
      sentCount += 1;
    } else if (st === 'in_negotiation') {
      inNegotiationCount += 1;
    } else if (st === 'accepted') {
      acceptedCount += 1;
      totalWonValue += gTotal;
    } else if (st === 'rejected') {
      rejectedCount += 1;
    } else if (st === 'draft') {
      draftCount += 1;
    }

    if (isActivePipelineStatus(st)) {
      activePipelineCount += 1;
      totalQuotedValue += gTotal;
    }
  }

  const avgDiscountPercent = totalGrossValue > 0 ? Math.round((totalDiscountValue / totalGrossValue) * 100 * 10) / 10 : 0;
  const winRate = (activePipelineCount + acceptedCount) > 0
    ? Math.round((acceptedCount / (activePipelineCount + acceptedCount)) * 100)
    : 0;

  return {
    total_quotations: totalQuotations,
    draft_count: draftCount,
    pending_approval_count: pendingApprovalCount,
    approved_count: approvedCount,
    sent_count: sentCount,
    in_negotiation_count: inNegotiationCount,
    active_pipeline_count: activePipelineCount,
    active_pipeline_value: totalQuotedValue,
    accepted_count: acceptedCount,
    rejected_count: rejectedCount,
    expired_count: expiredCount,
    total_quoted_value: totalQuotedValue,
    total_won_value: totalWonValue,
    total_discount_value: totalDiscountValue,
    total_expired_value: totalExpiredValue,
    avg_discount_percent: avgDiscountPercent,
    win_rate: winRate,
  };
}

/**
 * Convert quotation into a Customer (Party) + Order.
 */
async function convert(id, body = {}, user) {
  const { LeadQuotation, Lead, Party, Order, Product } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null }).populate('lead');
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (!isLeadManagerElevated(user)) {
    throw new ApiError(
      403,
      'Only administrators, managers, coordinators, and executives can convert quotations to orders'
    );
  }

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  if (quotation.status === 'expired' || (quotation.valid_until && new Date(quotation.valid_until) < new Date())) {
    throw new ApiError(400, 'This quotation has expired. Please extend its validity before converting to an order.');
  }

  if (quotation.status !== 'accepted') {
    throw new ApiError(400, 'Quotation must be accepted by the client before converting to an order');
  }

  const conversionType = body.conversion_type || 'existing_customer';
  let targetPartyId = body.party_id || quotation.party_id || (quotation.lead ? quotation.lead.party_id : null);
  let createdOrder = null;

  // Check if target party exists in database
  let existingParty = null;
  if (targetPartyId && mongoose.Types.ObjectId.isValid(targetPartyId)) {
    existingParty = await Party.findOne({ _id: targetPartyId, deletedAt: null });
  }

  // 1. Party resolution or creation (with deduplication)
  if (conversionType === 'new_customer' || (!existingParty && conversionType !== 'existing_customer')) {
    const partyData = body.party_data || {};
    const partyName = partyData.party_name || body.party_name || quotation.customer_name || (quotation.lead ? quotation.lead.company_name || quotation.lead.name : '');
    const cleanGst = (partyData.gst_no || body.gst_no || quotation.gstin) ? String(partyData.gst_no || body.gst_no || quotation.gstin).toUpperCase().trim() : '';
    const cleanPhone = quotation.phone || quotation.cell || (partyData.contacts && partyData.contacts[0] && partyData.contacts[0].phone) || (quotation.lead ? quotation.lead.phone : '') || '';

    // Check if matching Party exists by GST or exact name/phone
    if (cleanGst) {
      existingParty = await Party.findOne({ gst_no: cleanGst, deletedAt: null });
    }
    if (!existingParty && partyName && cleanPhone) {
      existingParty = await Party.findOne({
        party_name: { $regex: new RegExp(`^${partyName.trim()}$`, 'i') },
        mobile: cleanPhone.trim(),
        deletedAt: null,
      });
    }

    if (existingParty) {
      targetPartyId = existingParty._id;
    } else {
      const contactsList = Array.isArray(partyData.contacts) && partyData.contacts.length > 0
        ? partyData.contacts
        : [
            {
              name: quotation.kind_attn || quotation.customer_name || 'Primary Contact',
              phone: cleanPhone,
              email: quotation.email || '',
              designation: '',
              is_primary: true,
            },
          ];

      const billingAddr = partyData.billing_address || body.billing_address || {
        address_line_1: quotation.address?.address_line_1 || '',
        city: quotation.address?.city || '',
        state: quotation.address?.state || '',
        pincode: quotation.address?.pincode || '',
        country: quotation.address?.country || 'India',
      };
      const shippingAddr = partyData.shipping_address || body.shipping_address || billingAddr;

      const newParty = await Party.create({
        company_id: user.company_id,
        party_type: partyData.party_type || 'customer',
        party_name: partyName || 'Customer',
        contact_person: quotation.kind_attn || quotation.customer_name || '',
        mobile: cleanPhone,
        email: quotation.email || '',
        contacts: contactsList,
        gst_no: cleanGst || undefined,
        drug_license_no: partyData.drug_license_no || body.drug_license_no || undefined,
        district: partyData.district || billingAddr.city || '',
        state: partyData.state || billingAddr.state || '',
        payment_terms: partyData.payment_terms || body.payment_terms || 'Advance',
        billing_address: billingAddr,
        shipping_address: shippingAddr,
        created_by: user._id,
        is_active: true,
      });
      targetPartyId = newParty._id;

      await activityService.create({
        actor: user._id,
        entity_type: 'party',
        entity_id: newParty._id,
        action: 'created',
        message: `Party '${newParty.party_name}' created from Quotation #${quotation.quotation_no}`,
      });
    }
  } else if (existingParty) {
    targetPartyId = existingParty._id;
  }

  if (!targetPartyId) {
    throw new ApiError(400, 'A valid customer party is required to create an order');
  }

  // 2. Generate Order
  const orderNo = await generateOrderNo(targetPartyId, new Date());
  const items = [];
  let grossSubtotal = 0;
  let totalDiscount = 0;
  let subtotal = 0;
  let totalTax = 0;

  const sourceItems = Array.isArray(body.order_items) && body.order_items.length > 0
    ? body.order_items
    : Array.isArray(quotation.items) ? quotation.items : [];

  if (sourceItems.length > 0) {
    for (const prodItem of sourceItems) {
      let pName = prodItem.product_name || 'Product';
      const rateType = prodItem.applied_rate_type || 'SR';
      let unitPrice = 0;
      let gstPct = 18;
      const qty = Number(prodItem.quantity || prodItem.ordered_quantity || 1);

      let productId = prodItem.product || prodItem.productId;
      let pDoc = null;

      if (productId && mongoose.Types.ObjectId.isValid(productId)) {
        pDoc = await Product.findById(productId).lean();
      }
      if (!pDoc && pName) {
        pDoc = await Product.findOne({ product_name: pName, deletedAt: null }).lean();
      }
      if (!pDoc) {
        pDoc = await Product.findOne({ deletedAt: null }).lean();
      }

      if (pDoc) {
        productId = pDoc._id;
        pName = prodItem.product_name || pDoc.product_name || pName;
        if (rateType === 'SR') {
          unitPrice = Number(pDoc.base_price || 0);
        } else if (rateType === 'SRA') {
          unitPrice = Number(pDoc.minimum_sale_rate || pDoc.base_price || 0);
        } else if (rateType === 'CR') {
          unitPrice = Number(pDoc.mrp || pDoc.base_price || 0);
        } else {
          unitPrice = Number(pDoc.base_price || 0);
        }

        if (pDoc.gst_percent !== undefined) {
          gstPct = Number(pDoc.gst_percent);
        }
      }

      const priceSource = prodItem.rate ?? prodItem.unit_price;
      if (priceSource !== undefined && priceSource !== null && priceSource !== '') {
        const explicitPrice = Number(priceSource);
        if (Number.isFinite(explicitPrice) && explicitPrice >= 0) {
          unitPrice = explicitPrice;
        }
      }

      const gstSource = prodItem.gst_rate ?? prodItem.gst_percent;
      if (gstSource !== undefined && gstSource !== null && gstSource !== '') {
        const explicitGst = Number(gstSource);
        if (Number.isFinite(explicitGst) && explicitGst >= 0) {
          gstPct = explicitGst;
        }
      }

      if (!productId) {
        const createdProduct = await Product.create({
          company_id: user.company_id,
          product_name: pName,
          unit: prodItem.unit || 'pcs',
          base_price: unitPrice,
          minimum_sale_rate: unitPrice,
          mrp: unitPrice,
          gst_percent: gstPct,
          created_by: user._id,
        });
        productId = createdProduct._id;
      }

      const lineAmounts = computeQuotationLineAmounts({
        quantity: qty,
        rate: unitPrice,
        discount_percent: prodItem.discount_percent,
        discount_amount: prodItem.discount_amount,
        gst_percent: gstPct,
      });
      const gross = lineAmounts.grossAmount;
      const discPct = lineAmounts.discountPercent;
      const discAmt = lineAmounts.discountAmount;
      const taxable = lineAmounts.taxableAmount;
      const gst = Math.round(((taxable * gstPct) / 100) * 100) / 100;
      const total = Math.round((taxable + gst) * 100) / 100;

      grossSubtotal += gross;
      totalDiscount += discAmt;
      subtotal += taxable;
      totalTax += gst;

      items.push({
        product: productId,
        product_name: pName,
        sku: pDoc?.sku || prodItem.sku || undefined,
        unit: pDoc?.unit || prodItem.unit || 'pcs',
        ordered_quantity: qty,
        unit_price: unitPrice,
        applied_rate_type: rateType,
        discount_percent: discPct,
        discount_amount: discAmt,
        gst_percent: gstPct,
        taxable_amount: taxable,
        gst_amount: gst,
        total_amount: total,
        remarks: prodItem.description || prodItem.remarks || undefined,
        line_status: 'active',
      });
    }
  }

  if (items.length === 0) {
    throw new ApiError(400, 'Order must contain at least one valid product from the quotation/catalog');
  }

  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;
  const pDetails = quotation.proforma_details || {};
  const orderData = body.order_data || {};
  const customerPoNumber = String(orderData.customer_po_number || body.customer_po_number || quotation.customer_po_number || pDetails.customer_po_number || '').trim();
  const rawPoDate = orderData.customer_po_date || body.customer_po_date || quotation.customer_po_date || pDetails.customer_po_date;
  const customerPoDate = rawPoDate ? new Date(rawPoDate) : undefined;
  const advanceAmount = Number(orderData.advance_amount ?? body.advance_amount ?? quotation.advance_amount ?? 0) || 0;
  const paymentMode = String(orderData.payment_mode || body.payment_mode || quotation.payment_mode || '').trim();
  const paymentReference = String(orderData.payment_reference || body.payment_reference || quotation.payment_reference || '').trim();
  const rawDeliveryDate = orderData.delivery_date || pDetails.dispatch_date || quotation.valid_until;
  const expectedDeliveryDate = rawDeliveryDate ? new Date(rawDeliveryDate) : undefined;

  createdOrder = await Order.create({
    company_id: user.company_id,
    order_no: orderNo,
    order_date: orderData.order_date ? new Date(orderData.order_date) : new Date(),
    expected_delivery_date: expectedDeliveryDate,
    customer_po_number: customerPoNumber || undefined,
    customer_po_date: customerPoDate || undefined,
    advance_amount: advanceAmount,
    payment_mode: paymentMode || undefined,
    payment_reference: paymentReference || undefined,
    party: targetPartyId,
    customer: targetPartyId,
    lead: quotation.lead?._id || quotation.lead || undefined,
    quotation: quotation._id,
    assigned_sales_user: orderData.assigned_sales_user || body.assigned_sales_user || quotation.sales_person_user || quotation.created_by || user._id,
    current_assignee: orderData.assigned_sales_user || body.assigned_sales_user || quotation.sales_person_user || quotation.created_by || user._id,
    current_department: 'sales',
    pending_with_role: 'sales',
    order_items: items,
    subtotal: grossSubtotal,
    discount_amount: totalDiscount,
    taxable_amount: subtotal,
    gst_amount: totalTax,
    total_amount: grandTotal,
    grand_total: grandTotal,
    remarks: orderData.remarks || body.notes || quotation.subject || undefined,
    status: 'submitted',
    lifecycle_status: 'draft',
    workflow_stage: 'sales',
    current_action: 'submitted',
    created_by: user._id,
  });

  await activityService.create({
    actor: user._id,
    entity_type: 'order',
    entity_id: createdOrder._id,
    action: 'generated',
    message: `Order #${createdOrder.order_no} submitted upon conversion of Quotation #${quotation.quotation_no}${customerPoNumber ? ` (Customer PO: ${customerPoNumber})` : ''}`,
  });

  // 3. Update Quotation Status
  quotation.status = 'converted';
  quotation.party_id = targetPartyId;
  if (customerPoNumber) quotation.customer_po_number = customerPoNumber;
  if (customerPoDate) quotation.customer_po_date = customerPoDate;
  if (advanceAmount) quotation.advance_amount = advanceAmount;
  if (paymentMode) quotation.payment_mode = paymentMode;
  if (paymentReference) quotation.payment_reference = paymentReference;
  quotation.conversion = {
    converted_at: new Date(),
    converted_by: user._id,
    party_id: targetPartyId,
    order_id: createdOrder._id,
    customer_po_number: customerPoNumber,
    customer_po_date: customerPoDate,
    advance_amount: advanceAmount,
    payment_mode: paymentMode,
    payment_reference: paymentReference,
    notes: body.notes ? String(body.notes).trim() : '',
  };
  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    actor: user._id,
    entity_type: 'quotation',
    entity_id: quotation._id,
    action: 'status_changed',
    message: `Quotation #${quotation.quotation_no} converted to Order #${createdOrder.order_no}`,
    new_value: quotation.conversion,
  });

  // 4. Update linked Lead if exists
  if (quotation.lead) {
    const leadDoc = await Lead.findOne({ _id: quotation.lead._id || quotation.lead, deletedAt: null });
    if (leadDoc && leadDoc.status !== 'converted') {
      leadDoc.party_id = targetPartyId;
      leadDoc.status = 'converted';
      leadDoc.conversion = {
        converted_at: new Date(),
        converted_by: user._id,
        conversion_type: 'quotation',
        party_id: targetPartyId,
        order_id: createdOrder._id,
        quotation_id: quotation._id,
        notes: body.notes ? String(body.notes).trim() : '',
      };
      leadDoc.last_activity_at = new Date();
      leadDoc.updated_by = user._id;
      await leadDoc.save();

      await activityService.create({
        actor: user._id,
        entity_type: 'lead',
        entity_id: leadDoc._id,
        action: 'status_changed',
        message: `Lead #${leadDoc.lead_no} converted via Quotation #${quotation.quotation_no}`,
        new_value: leadDoc.conversion,
      });
    }
  }

  const populated = await LeadQuotation.findById(id)
    .populate('lead')
    .populate('created_by', 'name email department')
    .populate('signatory_user', 'name email department')
    .populate('conversion.converted_by', 'name email department')
    .populate('conversion.party_id')
    .populate('conversion.order_id', 'order_no status grand_total total_amount')
    .lean();

  return {
    quotation: populated,
    order: createdOrder,
    party_id: targetPartyId,
  };
}

/**
 * Record that a Proforma Invoice was generated / issued for this quotation.
 */
async function markProformaIssued(id, user) {
  const { LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null });
  if (!quotation) {
    throw new ApiError(404, 'Quotation not found');
  }

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  quotation.proforma_issued_at = new Date();
  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    actor: user._id,
    entity_type: 'quotation',
    entity_id: quotation._id,
    action: 'status_changed',
    message: `Proforma Invoice generated for Quotation #${quotation.quotation_no}`,
  });

  return getById(quotation._id, user);
}

/**
 * Save / Update Proforma Invoice details and mark as generated.
 */
async function saveProformaDetails(id, body = {}, user) {
  const { LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null });
  if (!quotation) {
    throw new ApiError(404, 'Quotation not found');
  }

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  const rawNo = quotation.quotation_no ? quotation.quotation_no.replace(/^QUOT-?/i, '') : String(Date.now()).slice(-4);
  const proformaNo = body.proforma_no || quotation.proforma_details?.proforma_no || `PINV-${rawNo}`;
  const invoiceDate = body.invoice_date ? new Date(body.invoice_date) : (quotation.proforma_details?.invoice_date || new Date());
  const poNumber = (body.customer_po_number ?? quotation.customer_po_number ?? '').trim();
  const poDate = body.customer_po_date ? new Date(body.customer_po_date) : (quotation.customer_po_date || null);
  const dispatchDate = body.dispatch_date ? new Date(body.dispatch_date) : (quotation.proforma_details?.dispatch_date || null);

  quotation.proforma_issued_at = new Date();
  if (poNumber) quotation.customer_po_number = poNumber;
  if (poDate) quotation.customer_po_date = poDate;

  quotation.proforma_details = {
    proforma_no: proformaNo,
    invoice_date: invoiceDate,
    customer_po_number: poNumber || 'Verbal',
    customer_po_date: poDate || invoiceDate,
    sales_person: body.sales_person || quotation.proforma_details?.sales_person || user.name || '',
    orc: body.orc || quotation.proforma_details?.orc || 'na',
    dispatch_date: dispatchDate,
    freight_charges: body.freight_charges || quotation.proforma_details?.freight_charges || 'Extra at actual',
    payment_terms: body.payment_terms || quotation.proforma_details?.payment_terms || 'On Delivery',
    transport: body.transport || quotation.proforma_details?.transport || '',
    ship_to_address: body.ship_to_address || quotation.proforma_details?.ship_to_address || 'same as billing',
    customer_type: body.customer_type || quotation.proforma_details?.customer_type || 'Dealer',
    installation_required: body.installation_required || quotation.proforma_details?.installation_required || 'No',
    gst_concession: body.gst_concession || quotation.proforma_details?.gst_concession || 'na',
    margin_sheet_attached: body.margin_sheet_attached || quotation.proforma_details?.margin_sheet_attached || 'na',
    kyc_status: body.kyc_status || quotation.proforma_details?.kyc_status || 'na',
    remarks: body.remarks || quotation.proforma_details?.remarks || '',
    message: body.message !== undefined ? body.message : (quotation.proforma_details?.message || quotation.message || ''),
    generated_at: new Date(),
    generated_by: user._id,
  };
  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    actor: user._id,
    entity_type: 'quotation',
    entity_id: quotation._id,
    action: 'status_changed',
    message: `Proforma Invoice #${proformaNo} generated and configured`,
    new_value: quotation.proforma_details,
  });

  return getById(quotation._id, user);
}

/**
 * Extend validity of a quotation (e.g. +7 days, +15 days, +30 days, or custom date) and restore from expired status if needed.
 */
async function extendValidity(id, body = {}, user) {
  const { LeadQuotation } = getModels();
  const quotation = await LeadQuotation.findOne({ _id: id, deletedAt: null });
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  if (quotation.status === 'converted') {
    throw new ApiError(400, 'No further actions allowed: this quotation has already been converted to an order');
  }

  if (!canActOnQuotationPipeline(user, quotation)) {
    throw new ApiError(
      403,
      'Only administrators, managers, coordinators, the quotation creator, or assigned sales representative can extend quotation validity'
    );
  }

  const previousValidUntil = quotation.valid_until;
  const previousStatus = quotation.status;

  let newValidUntil;
  if (body.valid_until) {
    newValidUntil = new Date(body.valid_until);
  } else {
    const days = Math.max(1, Number(body.validity_days) || 15);
    newValidUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    quotation.validity_days = days;
  }

  if (isNaN(newValidUntil.getTime())) {
    throw new ApiError(400, 'Invalid validity date provided');
  }

  quotation.valid_until = newValidUntil;
  quotation.expiry_alert_sent_at = null; // Reset alert trigger for new validity window

  // If quotation was expired, restore to an active status
  if (quotation.status === 'expired') {
    const targetStatus = body.restore_status || (quotation.approval_status === 'approved' ? 'sent' : 'draft');
    quotation.status = targetStatus;
  }

  if (!Array.isArray(quotation.validity_extension_history)) {
    quotation.validity_extension_history = [];
  }

  quotation.validity_extension_history.push({
    extended_at: new Date(),
    extended_by: user._id,
    previous_valid_until: previousValidUntil,
    new_valid_until: newValidUntil,
    reason: body.reason || 'Validity extended',
  });

  quotation.updated_by = user._id;
  await quotation.save();

  await activityService.create({
    actor: user._id,
    entity_type: 'quotation',
    entity_id: quotation._id,
    action: 'status_changed',
    message: `Validity of Quotation #${quotation.quotation_no} extended to ${newValidUntil.toLocaleDateString('en-IN')}${body.reason ? ` (Reason: ${body.reason})` : ''}`,
    new_value: {
      valid_until: newValidUntil,
      status: quotation.status,
      previous_status: previousStatus,
    },
  });

  return getById(quotation._id, user);
}

/**
 * Get specific version of a quotation.
 * If version equals current quotation version, returns current quotation.
 * Otherwise reconstitutes the quotation state from revision_history.
 */
async function getVersionDetails(id, versionNumber, user) {
  const quotation = await getById(id, user);
  const targetVersion = Number(versionNumber);

  if (quotation.version === targetVersion) {
    return quotation;
  }

  const historical = (quotation.revision_history || []).find((r) => Number(r.version) === targetVersion);
  if (!historical) {
    throw new ApiError(404, `Version ${targetVersion} not found for quotation ${quotation.quotation_no}`);
  }

  // Combine top-level identity fields with historical snapshot fields
  return {
    ...quotation,
    version: historical.version,
    quotation_no: historical.quotation_no || quotation.quotation_no,
    ref_no: historical.ref_no || quotation.ref_no,
    customer_ref: historical.customer_ref !== undefined ? historical.customer_ref : quotation.customer_ref,
    quotation_date: historical.quotation_date || quotation.quotation_date,
    valid_until: historical.valid_until || quotation.valid_until,
    validity_days: historical.validity_days || quotation.validity_days,
    subject: historical.subject !== undefined ? historical.subject : quotation.subject,
    message: historical.message !== undefined ? historical.message : quotation.message,
    quotation_message: historical.quotation_message !== undefined ? historical.quotation_message : quotation.quotation_message,
    customer_name: historical.customer_name || quotation.customer_name,
    kind_attn: historical.kind_attn !== undefined ? historical.kind_attn : quotation.kind_attn,
    phone: historical.phone !== undefined ? historical.phone : quotation.phone,
    cell: historical.cell !== undefined ? historical.cell : quotation.cell,
    email: historical.email !== undefined ? historical.email : quotation.email,
    gstin: historical.gstin !== undefined ? historical.gstin : quotation.gstin,
    address: historical.address && Object.keys(historical.address).length > 0 ? historical.address : quotation.address,
    items: historical.items && historical.items.length > 0 ? historical.items : quotation.items,
    subtotal: historical.subtotal !== undefined ? historical.subtotal : quotation.subtotal,
    total_discount: historical.total_discount !== undefined ? historical.total_discount : quotation.total_discount,
    gst_enabled: historical.gst_enabled !== undefined ? historical.gst_enabled : quotation.gst_enabled,
    total_gst: historical.total_gst !== undefined ? historical.total_gst : quotation.total_gst,
    round_off: historical.round_off !== undefined ? historical.round_off : quotation.round_off,
    grand_total: historical.grand_total !== undefined ? historical.grand_total : quotation.grand_total,
    amount_in_words: historical.amount_in_words || quotation.amount_in_words,
    terms_and_conditions: historical.terms_and_conditions && historical.terms_and_conditions.length > 0
      ? historical.terms_and_conditions
      : quotation.terms_and_conditions,
    branch_id: historical.branch_id || quotation.branch_id,
    branch_code: historical.branch_code || quotation.branch_code,
    company_branch_name: historical.company_branch_name || quotation.company_branch_name,
    company_name: historical.company_name || quotation.company_name,
    company_regd_address: historical.company_regd_address || quotation.company_regd_address,
    company_phone: historical.company_phone || quotation.company_phone,
    company_email: historical.company_email || quotation.company_email,
    company_gstin: historical.company_gstin || quotation.company_gstin,
    bank_name: historical.bank_name || quotation.bank_name,
    account_name: historical.account_name || quotation.account_name,
    account_number: historical.account_number || quotation.account_number,
    ifsc_code: historical.ifsc_code || quotation.ifsc_code,
    branch_name: historical.branch_name || quotation.branch_name,
    account_type: historical.account_type || quotation.account_type,
    signatory_name: historical.signatory_name || quotation.signatory_name,
    signatory_phone: historical.signatory_phone || quotation.signatory_phone,
    signatory_email: historical.signatory_email || quotation.signatory_email,
    signatory_designation: historical.signatory_designation || quotation.signatory_designation,
    signatory_user: historical.signatory_user || quotation.signatory_user,
    sales_person_name: historical.sales_person_name || quotation.sales_person_name,
    sales_person_phone: historical.sales_person_phone || quotation.sales_person_phone,
    sales_person_email: historical.sales_person_email || quotation.sales_person_email,
    sales_person_designation: historical.sales_person_designation || quotation.sales_person_designation,
    sales_person_user: historical.sales_person_user || quotation.sales_person_user,
    status: historical.status || quotation.status,
    approval_status: historical.approval_status || quotation.approval_status,
    approved_by: historical.approved_by || null,
    approved_at: historical.approved_at || null,
    saved_by: historical.saved_by || null,
    saved_at: historical.saved_at || null,
    change_summary: historical.change_summary || '',
    is_historical_snapshot: true,
  };
}

/**
 * Compare two versions of a quotation.
 */
async function compareVersions(id, fromVersion, toVersion, user) {
  const vFrom = await getVersionDetails(id, fromVersion, user);
  const vTo = await getVersionDetails(id, toVersion, user);

  const fromItems = vFrom.items || [];
  const toItems = vTo.items || [];

  const getItemKey = (it) => {
    const pId = typeof it.product === 'object' && it.product !== null ? it.product._id : it.product;
    return String(pId || it.product_name || '').trim().toLowerCase();
  };

  const fromMap = new Map();
  fromItems.forEach((it, idx) => fromMap.set(getItemKey(it) || `idx_${idx}`, it));

  const toMap = new Map();
  toItems.forEach((it, idx) => toMap.set(getItemKey(it) || `idx_${idx}`, it));

  const itemsComparison = [];
  const allKeys = new Set([...fromMap.keys(), ...toMap.keys()]);

  allKeys.forEach((key) => {
    const f = fromMap.get(key);
    const t = toMap.get(key);

    if (f && !t) {
      itemsComparison.push({
        status: 'removed',
        product_name: f.product_name,
        from: f,
        to: null,
      });
    } else if (!f && t) {
      itemsComparison.push({
        status: 'added',
        product_name: t.product_name,
        from: null,
        to: t,
      });
    } else if (f && t) {
      const qtyDiff = (t.quantity || 0) - (f.quantity || 0);
      const rateDiff = (t.rate || 0) - (f.rate || 0);
      const discountDiff = (t.discount_percent || 0) - (f.discount_percent || 0);
      const totalDiff = (t.line_total || 0) - (f.line_total || 0);

      const isChanged = qtyDiff !== 0 || rateDiff !== 0 || discountDiff !== 0 || totalDiff !== 0;

      itemsComparison.push({
        status: isChanged ? 'modified' : 'unchanged',
        product_name: t.product_name,
        from: f,
        to: t,
        diff: {
          quantity_delta: qtyDiff,
          rate_delta: rateDiff,
          discount_delta: discountDiff,
          line_total_delta: totalDiff,
        },
      });
    }
  });

  return {
    from_version: Number(fromVersion),
    to_version: Number(toVersion),
    from_saved_at: vFrom.saved_at || vFrom.createdAt,
    to_saved_at: vTo.saved_at || vTo.updatedAt,
    from_saved_by: vFrom.saved_by,
    to_saved_by: vTo.saved_by,
    financial_comparison: {
      subtotal_from: vFrom.subtotal || 0,
      subtotal_to: vTo.subtotal || 0,
      subtotal_delta: (vTo.subtotal || 0) - (vFrom.subtotal || 0),
      discount_from: vFrom.total_discount || 0,
      discount_to: vTo.total_discount || 0,
      discount_delta: (vTo.total_discount || 0) - (vFrom.total_discount || 0),
      gst_from: vFrom.total_gst || 0,
      gst_to: vTo.total_gst || 0,
      gst_delta: (vTo.total_gst || 0) - (vFrom.total_gst || 0),
      grand_total_from: vFrom.grand_total || 0,
      grand_total_to: vTo.grand_total || 0,
      grand_total_delta: (vTo.grand_total || 0) - (vFrom.grand_total || 0),
    },
    items_comparison: itemsComparison,
    terms_from: vFrom.terms_and_conditions || [],
    terms_to: vTo.terms_and_conditions || [],
  };
}

module.exports = {
  create,
  listAll,
  listByLead,
  list: listByLead, // alias for backwards compatibility
  getById,
  getVersionDetails,
  compareVersions,
  update,
  remove,
  convert,
  markProformaIssued,
  saveProformaDetails,
  extendValidity,
  autoExpireQuotations,
  checkAndSendPreExpiryAlerts,
  submitForApproval,
  approve,
  reject,
  scheduleFollowUp,
  listFollowUps,
  completeFollowUp,
  reviseQuotation,
  getDefaultTerms,
  getDashboardStats,
  generateQuotationNo,
  numberToIndianWords,
  getDefaultTermsAndConditions,
  isQuotationManager,
};
